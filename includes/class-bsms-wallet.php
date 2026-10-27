<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Wallet {
    public static function ensure_wallet($user_id){
        global $wpdb;
        $t = BSMS_DB::table('wallets');
        $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$wpdb->prefix}bsms_wallets (user_id, updated_at) VALUES (%d, %s)", $user_id, BSMS_Util::now_gmt()));
    }

    public static function get($user_id){
        self::ensure_wallet($user_id);
        global $wpdb;
        $t = BSMS_DB::table('wallets');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_wallets WHERE user_id=%d", $user_id));
    }

    public static function get_balance_kobo($user_id){
        $w = self::get($user_id);
        return intval($w->sms_balance_kobo);
    }

    /**
     * v3.4.2 canonical admin wallet adjustment (portal admin and WordPress admin).
     * Each adjustment gets a unique reference. The same admin repeating the same
     * amount for the same customer within 15 seconds is treated as a double
     * click and refused, so one click can never credit twice.
     */
    public static function admin_adjust($user_id, $signed_kobo, $reason='', $source='portal'){
        $user_id = intval($user_id);
        $signed_kobo = intval($signed_kobo);
        if ($user_id < 1 || !get_userdata($user_id)) return new WP_Error('invalid_user', __('Selected user was not found.', 'bulk-sms-portal'));
        if ($signed_kobo === 0) return new WP_Error('invalid_amount', __('Enter a non-zero amount. Use a minus sign to debit, for example -500.', 'bulk-sms-portal'));
        $admin = get_current_user_id();
        $guard = 'bsms_adj_' . md5($admin . '|' . $user_id . '|' . $signed_kobo);
        if (get_transient($guard)) return new WP_Error('duplicate_adjustment', __('This exact adjustment was just made. If you really want to repeat it, wait 15 seconds and try again.', 'bulk-sms-portal'));
        set_transient($guard, 1, 15);
        $reason = sanitize_text_field((string)$reason);
        $reference = 'ADMIN-' . ($source === 'portal' ? 'FRONT' : 'WP') . '-' . $user_id . '-' . time() . '-' . wp_generate_password(6, false, false);
        $meta = array('admin'=>$admin, 'reason'=>$reason !== '' ? $reason : 'Manual wallet adjustment', 'source'=>$source, 'signed_amount_kobo'=>$signed_kobo);
        $res = $signed_kobo > 0 ? self::credit_sms($user_id, $signed_kobo, $reference, $meta) : self::debit_sms($user_id, abs($signed_kobo), $reference, $meta);
        if (is_wp_error($res)) { delete_transient($guard); return $res; }
        if (class_exists('BSMS_Security')) BSMS_Security::log('wallet_adjusted', 'User SMS wallet manually adjusted', array('amount_kobo'=>$signed_kobo, 'reason'=>$reason, 'source'=>$source, 'reference'=>$reference), 'user', $user_id, $user_id);
        return array('ok'=>true, 'reference'=>$reference, 'message'=>$signed_kobo > 0 ? __('Wallet credited successfully.', 'bulk-sms-portal') : __('Wallet debited successfully.', 'bulk-sms-portal'));
    }

    /** v3.4.2: money set aside for this customer's messages that are queued but not yet charged. */
    public static function reserved_kobo($user_id){
        global $wpdb;
        $jt = BSMS_DB::table('jobs');
        return intval($wpdb->get_var($wpdb->prepare("SELECT COALESCE(SUM(cost_kobo),0) FROM {$wpdb->prefix}bsms_jobs WHERE user_id=%d AND status_bucket='queued'", intval($user_id))));
    }

    /** Balance that can be spent on a new send right now. */
    public static function available_kobo($user_id){
        return self::get_balance_kobo($user_id) - self::reserved_kobo($user_id);
    }

    public static function estimated_units($balance_kobo){
        // Estimate from the standard price bands. A network with its own price
        // may cost more or less per page.
        return class_exists('BSMS_Pricing')
            ? BSMS_Pricing::estimated_units_for_amount(max(0, intval($balance_kobo)), 'normal', '234')
            : 0;
    }


    public static function credit_sms($user_id, $amount_kobo, $reference, $meta=array()){
        $amount_kobo = abs(intval($amount_kobo));
        return self::change($user_id, 'sms_balance_kobo', $amount_kobo, 'sms_credit', 'sms', $reference, $meta);
    }



    /**
     * Debit an account-generated SMS notification.
     *
     * Unlike normal message sending, this may move the SMS wallet below zero,
     * but only down to the configured notification overdraft floor.
     * Default floor = 5 base SMS units. Future wallet credits naturally
     * recover the negative balance before spendable credit becomes available.
     */
    public static function debit_notification_sms($user_id, $amount_kobo, $reference, $meta=array()){
        $amount_kobo = abs(intval($amount_kobo));
        $max_units = max(0, intval(get_option('bsms_notification_overdraft_units', 5)));
        $floor_kobo = -$max_units * max(1, intval(BSMS_Pricing::base_unit_kobo()));
        return self::mutate($user_id, -$amount_kobo, 'sms_balance_kobo', 'notification_sms_charge', 'sms', $reference, __('Account notification SMS', 'bulk-sms-portal'), $meta, $floor_kobo);
    }

    public static function refund_notification_sms($user_id, $amount_kobo, $reference, $meta=array()){
        $amount_kobo = abs(intval($amount_kobo));
        if (!$amount_kobo) return true;
        return self::mutate($user_id, $amount_kobo, 'sms_balance_kobo', 'notification_sms_refund', 'sms', sanitize_text_field((string)$reference) . '-REFUND', __('Failed account notification SMS refund', 'bulk-sms-portal'), $meta);
    }


    public static function debit_sms($user_id, $amount_kobo, $reference, $meta=array()){
        return self::mutate($user_id, -abs(intval($amount_kobo)), 'sms_balance_kobo', 'sms_charge', 'sms', $reference, __('SMS charge', 'bulk-sms-portal'), $meta, 0);
    }

    /** Return a message charge once, only if the matching debit exists. */
    public static function refund_sms_job($user_id, $job_id, $amount_kobo, $meta=array()){
        $job_id = absint($job_id);
        $amount_kobo = abs(intval($amount_kobo));
        if (!$job_id || !$amount_kobo) return new WP_Error('refund_unmatched', __('This message has no charge to return.', 'bulk-sms-portal'));
        return self::mutate($user_id, $amount_kobo, 'sms_balance_kobo', 'sms_refund', 'sms', 'REFUND-JOB-' . $job_id, __('Failed SMS charge returned', 'bulk-sms-portal'), $meta + array('job_id'=>$job_id));
    }


    private static function change($user_id, $field, $delta, $type, $wallet, $reference, $meta){
        return self::mutate($user_id, $delta, $field, $type, $wallet, $reference, '', $meta);
    }

    /** Change a wallet balance and write its unique audit entry in the same transaction. */
    private static function mutate($user_id, $delta, $field, $type, $wallet, $reference, $comments, $meta, $floor=null){
        global $wpdb;
        $user_id = intval($user_id);
        $delta = intval($delta);
        $reference = sanitize_text_field((string)$reference);
        if ($user_id <= 0 || $delta === 0 || $reference === '' || strlen($reference) > 100) return new WP_Error('invalid_wallet_change', __('Enter a valid amount and reference.', 'bulk-sms-portal'));
        if (!in_array($field, array('sms_balance_kobo', 'bonus_balance_kobo'), true)) return new WP_Error('invalid_wallet_change', __('Unable to update this balance.', 'bulk-sms-portal'));
        $wt = BSMS_DB::table('wallets');
        $lt = BSMS_DB::table('ledger');
        // A transaction cannot protect balances on nontransactional database tables.
        foreach (array($wt, $lt) as $table) {
            $engine = class_exists('BSMS_DB') && method_exists('BSMS_DB', 'table_engine') ? BSMS_DB::table_engine($table) : '';
            if ($engine !== 'innodb') {
                // Never silently bypass transactional safety or alter production
                // financial tables during a send. Record actionable diagnostics.
                if (defined('WP_DEBUG') && WP_DEBUG) error_log('[Bulk SMS Portal wallet] Transaction storage check failed for ' . preg_replace('/[^A-Za-z0-9_]/', '', $table) . ' (engine=' . ($engine === null ? 'unknown' : preg_replace('/[^A-Za-z0-9_]/', '', (string)$engine)) . ')'); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Written only when WP_DEBUG is on.
                return new WP_Error('wallet_storage_unavailable', __('Wallet changes are temporarily unavailable. Please contact support.', 'bulk-sms-portal'));
            }
        }
        if ($wpdb->query('START TRANSACTION') === false) return new WP_Error('wallet_unavailable', __('Wallet changes are temporarily unavailable. Please try again.', 'bulk-sms-portal'));
        $rollback = function($error) use ($wpdb) {
            $wpdb->query('ROLLBACK');
            return $error;
        };
        $inserted = $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$wpdb->prefix}bsms_wallets (user_id, updated_at) VALUES (%d, %s)", $user_id, BSMS_Util::now_gmt()));
        if ($inserted === false) return $rollback(new WP_Error('wallet_unavailable', __('Wallet changes are temporarily unavailable. Please try again.', 'bulk-sms-portal')));
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_wallets WHERE user_id=%d FOR UPDATE", $user_id));
        if (!$row) return $rollback(new WP_Error('wallet_unavailable', __('Wallet changes are temporarily unavailable. Please try again.', 'bulk-sms-portal')));
        // Locking the owner's wallet serializes retries before the reference check.
        $existing = $wpdb->get_row($wpdb->prepare("SELECT user_id, type, wallet, amount_kobo FROM {$wpdb->prefix}bsms_ledger WHERE reference=%s LIMIT 1", $reference));
        if ($existing) {
            // Older queue refunds were recorded as sms_credit with this same unique reference.
            $existing_type = $type === 'sms_refund' && $existing->type === 'sms_credit' ? 'sms_refund' : $existing->type;
            $same = intval($existing->user_id) === $user_id && $existing_type === $type && $existing->wallet === $wallet && intval($existing->amount_kobo) === $delta;
            if ($wpdb->query('COMMIT') === false) return $rollback(new WP_Error('wallet_unavailable', __('Wallet changes are temporarily unavailable. Please try again.', 'bulk-sms-portal')));
            return $same ? true : new WP_Error('reference_conflict', __('This payment or message reference was already used for another wallet change.', 'bulk-sms-portal'));
        }
        if ($type === 'notification_sms_refund') {
            $charge_reference = substr($reference, 0, -7);
            $charge = $wpdb->get_row($wpdb->prepare("SELECT user_id, amount_kobo FROM {$wpdb->prefix}bsms_ledger WHERE reference=%s AND type='notification_sms_charge' LIMIT 1", $charge_reference));
            if (!$charge || intval($charge->user_id) !== $user_id || intval($charge->amount_kobo) !== -$delta) {
                return $rollback(new WP_Error('refund_unmatched', __('We could not match this refund to its original charge.', 'bulk-sms-portal')));
            }
        }
        if ($type === 'sms_refund') {
            $job_id = absint(substr($reference, strlen('REFUND-JOB-')));
            if (!$job_id || $reference !== 'REFUND-JOB-' . $job_id) return $rollback(new WP_Error('refund_unmatched', __('This message has no matching charge.', 'bulk-sms-portal')));
            $charge = $wpdb->get_row($wpdb->prepare("SELECT user_id, amount_kobo FROM {$wpdb->prefix}bsms_ledger WHERE reference=%s AND type='sms_charge' LIMIT 1", 'JOB-' . $job_id));
            if (!$charge || intval($charge->user_id) !== $user_id || intval($charge->amount_kobo) !== -$delta) {
                return $rollback(new WP_Error('refund_unmatched', __('This message has no matching charge.', 'bulk-sms-portal')));
            }
        }
        $balance = intval($row->$field);
        if ($floor !== null && $balance + $delta < $floor) {
            $code = $type === 'notification_sms_charge' ? 'notification_overdraft_limit' : 'insufficient_balance';
            return $rollback(new WP_Error($code, $type === 'notification_sms_charge' ? __('Notification SMS balance limit reached.', 'bulk-sms-portal') : __('Insufficient SMS balance.', 'bulk-sms-portal')));
        }
        if ($type === 'sms_credit' && $balance < 0) {
            $meta['notification_debt_before_kobo'] = -$balance;
            $meta['notification_debt_recovered_kobo'] = min(-$balance, $delta);
            $meta['notification_debt_recovery'] = 1;
        }
        if ($type === 'notification_sms_charge') {
            $meta += array('notification_overdraft_allowed'=>1, 'notification_overdraft_floor_kobo'=>$floor, 'balance_before_kobo'=>$balance, 'balance_after_kobo'=>$balance + $delta);
        }
        $updated = $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}bsms_wallets SET %i = %i + %d, updated_at=%s WHERE user_id=%d", $field, $field, $delta, BSMS_Util::now_gmt(), $user_id));
        if ($updated !== 1) return $rollback(new WP_Error('wallet_unavailable', __('Wallet changes are temporarily unavailable. Please try again.', 'bulk-sms-portal')));
        $recorded = self::ledger($user_id, $type, $delta, $wallet, $reference, $comments, $meta);
        if (is_wp_error($recorded)) return $rollback(new WP_Error($recorded->get_error_code() === 'duplicate_reference' ? 'reference_conflict' : 'wallet_unavailable', __('Wallet changes could not be saved. Please try again or contact support.', 'bulk-sms-portal')));
        if ($wpdb->query('COMMIT') === false) return $rollback(new WP_Error('wallet_unavailable', __('Wallet changes are temporarily unavailable. Please try again.', 'bulk-sms-portal')));
        if ($delta > 0 && class_exists('BSMS_Notifications') && in_array($type, array('topup','sms_credit','bonus_credit'), true)) {
            BSMS_Notifications::notify($user_id, 'credit', __('Wallet credited', 'bulk-sms-portal'), sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Your wallet has been credited with %1$s. Reference: %2$s.', 'bulk-sms-portal'), BSMS_Util::money($delta), $reference), array('wallet'=>$wallet,'reference'=>$reference));
        }
        return true;
    }

    public static function ledger($user_id, $type, $amount_kobo, $wallet, $reference, $comments='', $meta=array()){
        global $wpdb;
        $reference = sanitize_text_field((string)$reference);
        $t = BSMS_DB::table('ledger');
        if ($reference !== '' && $wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bsms_ledger WHERE reference=%s LIMIT 1", $reference))) {
            return new WP_Error('duplicate_reference', __('Ledger reference already exists.', 'bulk-sms-portal'));
        }
        $ok = $wpdb->insert($t, array(
            'user_id'=>$user_id,
            'type'=>$type,
            'channel'=>'system',
            'amount_kobo'=>intval($amount_kobo),
            'wallet'=>$wallet,
            'currency'=>'NGN',
            'status'=>'success',
            'reference'=>$reference,
            'provider'=>'system',
            'comments'=>$comments,
            'meta_json'=>wp_json_encode($meta),
            'created_at'=>BSMS_Util::now_gmt(),
        ), array('%d','%s','%s','%d','%s','%s','%s','%s','%s','%s','%s','%s'));
        if ($ok === false) {
            if ($reference !== '' && stripos((string)$wpdb->last_error, 'Duplicate') !== false) {
                return new WP_Error('duplicate_reference', __('Ledger reference already exists.', 'bulk-sms-portal'));
            }
            return new WP_Error('ledger_failed', sprintf(/* translators: %s: a value filled in when shown */ __('Ledger insert failed: %s', 'bulk-sms-portal'), $wpdb->last_error));
        }
        return true;
    }
}
