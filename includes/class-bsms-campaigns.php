<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Campaigns {
    public static function approved_sender_ids($user_id){
        global $wpdb;
        $t = BSMS_DB::table('sender_ids');
        return $wpdb->get_col($wpdb->prepare(
            "SELECT sender_id FROM {$wpdb->prefix}bsms_sender_ids WHERE user_id=%d AND status='approved' ORDER BY sender_id ASC",
            $user_id
        ));
    }

    public static function default_sender($user_id){
        $approved = self::approved_sender_ids($user_id);
        if (!empty($approved)) return $approved[0];
        return BSMS_Util::shared_sender();
    }

    /**
     * v3.4.1: the same account checks for every API send path (/api/send and
     * /wp-json/bsms-api/v1/sms/send) as the portal's Send SMS page applies:
     * suspension, send permission, API access, and the account's limits.
     */
    public static function api_gate($user_id, $recipient_count, $scheduled=false){
        $user_id = intval($user_id);
        if (class_exists('BSMS_API') && BSMS_API::account_suspended($user_id)) return new WP_Error('account_suspended', __('This account is suspended.', 'bulk-sms-portal'), array('status'=>403));
        wp_set_current_user($user_id);
        if (class_exists('BSMS_REST') && !BSMS_REST::can_send_sms()) return new WP_Error('send_not_permitted', __('SMS sending is not enabled for this account.', 'bulk-sms-portal'), array('status'=>403));
        if (class_exists('BSMS_Entitlements')) {
            if (!BSMS_Entitlements::is_enabled('api_access', $user_id)) return new WP_Error('api_not_enabled', __('API access is not enabled for this account.', 'bulk-sms-portal'), array('status'=>403));
            if ($scheduled && !BSMS_Entitlements::is_enabled('scheduled_sms', $user_id)) return new WP_Error('scheduled_not_enabled', __('Scheduled SMS is not available for this account.', 'bulk-sms-portal'), array('status'=>403));
            $gate = BSMS_Entitlements::enforce_limit('recipients_per_campaign', intval($recipient_count), $user_id, array('recipients'=>intval($recipient_count)), true);
            if (is_wp_error($gate)) return $gate;
            $gate = BSMS_Entitlements::enforce_limit('campaigns_per_day', 1, $user_id);
            if (is_wp_error($gate)) return $gate;
        }
        return true;
    }

    public static function create($user_id, $name, $message, $numbers, $sender_id='', $route='normal', $schedule_at=null, $dedupe=true){
        $sender = BSMS_Util::validate_sender_id($sender_id);
        $approved = self::approved_sender_ids($user_id);
        if (!$sender || !in_array($sender, $approved, true)) $sender = self::default_sender($user_id);

        $cc = BSMS_Util::default_country($user_id);
        $clean = array();
        $seen = array();
        $duplicates = array();
        $invalid = array();

        foreach ((array)$numbers as $raw) {
            $raw_value = trim((string)$raw);
            if ($raw_value === '') continue;
            $p = BSMS_Util::normalize_phone_e164($raw_value, $cc);
            if (!$p) {
                $invalid[] = $raw_value;
                continue;
            }
            if ($dedupe && isset($seen[$p])) {
                $duplicates[] = array('raw'=>$raw_value, 'phone'=>$p);
                continue;
            }
            $seen[$p] = true;
            $clean[] = $p;
        }
        if (empty($clean)) return new WP_Error('no_numbers', __('No valid unique recipients.', 'bulk-sms-portal'));

        $breakdown = BSMS_Pricing::price_breakdown($clean, $message, $route, $user_id);
        $pages = intval($breakdown['pages']);
        $total = intval($breakdown['total_kobo']);
        $no_rate_set = array_flip((array)($breakdown['no_rate'] ?? array()));
        $priced = array_values(array_filter($clean, function($p) use ($no_rate_set){ return !isset($no_rate_set[$p]); }));
        // v3.7.1: refuse before charging when no SMS service is set up to send them.
        if ($priced && !BSMS_Providers::ready_for($priced, $route, $user_id)) {
            return new WP_Error('sending_not_ready', __('Sending is not available right now, so nothing was sent or charged. Please contact support.', 'bulk-sms-portal'), array('status'=>503));
        }
        if (!$priced) {
            $why = array_values((array)($breakdown['no_rate_reasons'] ?? array()));
            $msg = (count(array_unique($why)) === 1 && $why[0] === 'no_service') ? __('Sending to these countries is not available yet, so nothing was sent or charged.', 'bulk-sms-portal')
                : ((count(array_unique($why)) === 1 && $why[0] === 'no_dnd_price') ? __('Reaching Do Not Disturb numbers is not available, so nothing was sent or charged.', 'bulk-sms-portal')
                : __('We cannot send to these numbers yet (no price is set for their country), so nothing was sent or charged.', 'bulk-sms-portal'));
            return new WP_Error('no_rate', $msg, array('no_rate'=>count($clean)));
        }

        global $wpdb;
        $ct = BSMS_DB::table('campaigns');
        $jt = BSMS_DB::table('jobs');
        $wt = BSMS_DB::table('wallets');

        BSMS_Wallet::ensure_wallet($user_id);
        $wpdb->query('START TRANSACTION');
        // v3.4.2: lock the wallet and count money already reserved by messages
        // still waiting to send, so two sends at the same moment cannot both
        // pass the balance check and then fail half-way.
        $balance = intval($wpdb->get_var($wpdb->prepare("SELECT sms_balance_kobo FROM {$wpdb->prefix}bsms_wallets WHERE user_id=%d FOR UPDATE", $user_id)));
        $reserved = BSMS_Wallet::reserved_kobo($user_id);
        $available = $balance - $reserved;
        if ($available < $total) {
            $wpdb->query('ROLLBACK');
            $shortfall = max(0, $total - $available);
            $msg = sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('Insufficient SMS balance. Required: %1$s, Available: %2$s, Shortfall: %3$s.', 'bulk-sms-portal'), BSMS_Util::money($total), BSMS_Util::money(max(0, $available)), BSMS_Util::money($shortfall));
            if ($reserved > 0) $msg .= sprintf(/* translators: %s: a value filled in when shown */ __(' %s of your balance is set aside for messages that are still waiting to send.', 'bulk-sms-portal'), BSMS_Util::money($reserved));
            return new WP_Error('insufficient_balance', $msg, array(
                'required_kobo' => intval($total),
                'available_kobo' => intval(max(0, $available)),
                'reserved_kobo' => intval($reserved),
                'shortfall_kobo' => intval($shortfall),
                'can_send' => false,
            ));
        }

        $created = $wpdb->insert($ct, array(
            'user_id'=>$user_id,
            'name'=>sanitize_text_field($name),
            'message'=>$message,
            'sender_id'=>$sender,
            'route'=>BSMS_Providers::normalise_route($route),
            'dedupe_mode'=>$dedupe ? 'campaign' : 'none',
            'status'=>'queued',
            'schedule_at'=>$schedule_at,
            'recipients_count'=>count($priced),
            'pages'=>$pages,
            'created_at'=>BSMS_Util::now_gmt(),
        ));
        $campaign_id = intval($wpdb->insert_id);
        if ($created === false || $campaign_id < 1) {
            $wpdb->query('ROLLBACK');
            return new WP_Error('campaign_db_error', __('The campaign could not be recorded. Please try again.', 'bulk-sms-portal'), array('db_error'=>$wpdb->last_error));
        }

        $meta_map = array();
        foreach ($breakdown['rows'] as $row) $meta_map[$row['phone']] = $row;
        $now = BSMS_Util::now_gmt();
        $normal_route = BSMS_Providers::normalise_route($route);
        $rows = array();
        foreach ($priced as $to) {
            $row = $meta_map[$to] ?? array();
            $price = intval($row['cost_kobo'] ?? 0);
            $rows[] = array($to, $to, isset($row['route']) ? BSMS_Providers::normalise_route($row['route']) : BSMS_Providers::route_for_recipient($route, $to, $cc),
                'api', 'queued', 'QUEUED', sanitize_text_field($row['network'] ?? ''), '', intval($row['unit_price_kobo'] ?? $price), $price,
                isset($row['country']) ? (sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('Pricing: %1$s / %2$s / %3$s', 'bulk-sms-portal'), $row['country'], ($row['network'] ?? 'all'), BSMS_Util::money($price))) : '');
        }
        foreach ($duplicates as $dup) {
            $rows[] = array($dup['phone'], $dup['raw'], $normal_route, 'local', 'skipped', 'SKIPPED_DUPLICATE', '', 'DUPLICATE', 0, 0, __('Skipped duplicate recipient; not sent and not charged.', 'bulk-sms-portal'));
        }
        foreach ($invalid as $raw) {
            $rows[] = array('', $raw, $normal_route, 'local', 'skipped', 'SKIPPED_INVALID', '', 'INVALID_NUMBER', 0, 0, __('Skipped invalid recipient; not sent and not charged.', 'bulk-sms-portal'));
        }
        $why = (array)($breakdown['no_rate_reasons'] ?? array());
        foreach (array_keys($no_rate_set) as $to) {
            $rows[] = array($to, $to, isset($meta_map[$to]['route']) ? BSMS_Providers::normalise_route($meta_map[$to]['route']) : 'international', 'local', 'skipped', 'SKIPPED_NO_RATE', '', 'NO_RATE', 0, 0, BSMS_Pricing::reason_text($why[$to] ?? ''));
        }

        // v3.4.2: insert recipients in batches instead of one query per number.
        foreach (array_chunk($rows, 200) as $chunk) {
            $values = array();
            foreach ($chunk as $r) {
                $values[] = $wpdb->prepare('(%d,%d,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%d,%d,%s,%s)',
                    $campaign_id, $user_id, $r[0], $r[1], $message, $message, $sender, $r[2], $r[3], $r[4], $r[5], $r[6], $r[7], $r[8], $r[9], $r[10], $now);
            }
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Each row of values is built with $wpdb->prepare() above.
            $ok = $wpdb->query("INSERT INTO {$wpdb->prefix}bsms_jobs (campaign_id,user_id,to_phone_e164,recipient,body,message,sender_id,route,provider,status_bucket,provider_status,network,err_code,unit_price_kobo,cost_kobo,last_error,updated_at) VALUES " . implode(',', $values));
            if ($ok === false) {
                $db_error = $wpdb->last_error;
                $wpdb->query('ROLLBACK');
                return new WP_Error('job_db_error', __('The SMS recipients could not be queued. Nothing was charged.', 'bulk-sms-portal'), array('db_error'=>$db_error));
            }
        }

        $wpdb->query('COMMIT');

        return array(
            'campaign_id'=>$campaign_id,
            'recipients'=>count($priced),
            'entered'=>count(array_filter(array_map('trim', (array)$numbers))),
            'duplicates'=>count($duplicates),
            'invalid'=>count($invalid),
            'no_rate'=>count($no_rate_set),
            'sender_id'=>$sender,
            'cost_kobo'=>$total,
            'summary'=>array(
                'unique_valid'=>count($priced),
                'duplicates_skipped'=>count($duplicates),
                'invalid_skipped'=>count($invalid),
                'no_rate_skipped'=>count($no_rate_set),
                'reserved_kobo'=>$total,
            ),
        );
    }
}
