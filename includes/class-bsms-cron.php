<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Cron {
    const HOOK = 'bsms_pro_queue_worker';

    public static function init(){ add_action(self::HOOK, array(__CLASS__, 'run_worker')); }

    public static function activate(){
        if (!wp_next_scheduled(self::HOOK)) wp_schedule_event(time()+60, 'minute', self::HOOK);
    }

    public static function deactivate(){
        $ts = wp_next_scheduled(self::HOOK);
        if ($ts) wp_unschedule_event($ts, self::HOOK);
    }

    const LOCK = 'bsms_worker_lock';
    const LOCK_TTL = 300;      // a crashed run releases the lock after 5 minutes
    const TIME_BUDGET = 40;    // stop picking new messages after 40 seconds
    const CLAIM_TTL = 900;     // a claimed message untouched for 15 minutes is recovered

    /**
     * Only one worker may run at a time. WP-Cron, a server cron and the
     * "send now" trigger can all start the worker; without this lock two runs
     * picked the same queued messages and sent them twice.
     */
    private static function acquire_lock(){
        global $wpdb;
        $token = time() . '-' . wp_generate_password(8, false, false);
        if (add_option(self::LOCK, $token, '', 'no')) return $token;
        $current = (string)$wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name=%s", self::LOCK));
        $started = intval(strtok($current, '-'));
        if ($current !== '' && time() - $started < self::LOCK_TTL) return false;
        // Take over a stale lock only if nobody else did first (compare-and-swap).
        $taken = $wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value=%s WHERE option_name=%s AND option_value=%s", $token, self::LOCK, $current));
        wp_cache_delete(self::LOCK, 'options');
        wp_cache_delete('notoptions', 'options');
        return intval($taken) === 1 ? $token : false;
    }

    private static function release_lock($token){
        global $wpdb;
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name=%s AND option_value=%s", self::LOCK, $token));
        wp_cache_delete(self::LOCK, 'options');
    }

    /** Claim one queued message so no other run can send it. */
    private static function claim_job($job_id){
        global $wpdb;
        $jt = BSMS_DB::table('jobs');
        $claimed = $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}bsms_jobs SET status_bucket='sending', updated_at=%s WHERE id=%d AND status_bucket='queued'", BSMS_Util::now_gmt(), intval($job_id)));
        return intval($claimed) === 1;
    }

    /**
     * Messages left in "sending" by a run that crashed. If the wallet was
     * already charged the message may have reached the provider, so it is marked
     * unconfirmed (never resent automatically); otherwise it goes back to the queue.
     */
    private static function recover_claimed_jobs(){
        global $wpdb;
        $jt = BSMS_DB::table('jobs');
        $lt = BSMS_DB::table('ledger');
        $cutoff = gmdate('Y-m-d H:i:s', time() - self::CLAIM_TTL);
        $rows = $wpdb->get_results($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bsms_jobs WHERE status_bucket='sending' AND updated_at < %s LIMIT 200", $cutoff));
        foreach ((array)$rows as $row) {
            $charged = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bsms_ledger WHERE reference=%s LIMIT 1", 'JOB-' . intval($row->id)));
            if ($charged) {
                $wpdb->update($jt, array('status_bucket'=>'pending', 'provider_status'=>'UNKNOWN', 'err_code'=>'SEND_UNCONFIRMED',
                    'last_error'=>__('Sending was interrupted. The SMS service may or may not have received this message, so it was not sent again.', 'bulk-sms-portal'),
                    'sync_notes'=>__('Recovered after an interrupted worker run.', 'bulk-sms-portal'), 'updated_at'=>BSMS_Util::now_gmt()), array('id'=>intval($row->id), 'status_bucket'=>'sending'));
            } else {
                $wpdb->update($jt, array('status_bucket'=>'queued', 'updated_at'=>BSMS_Util::now_gmt()), array('id'=>intval($row->id), 'status_bucket'=>'sending'));
            }
        }
    }

    /**
     * One-time repair for campaigns that earlier builds marked "sent" after the
     * first message, which left the rest of their recipients queued forever.
     */
    public static function recover_stranded_campaigns(){
        global $wpdb;
        $ct = BSMS_DB::table('campaigns');
        $jt = BSMS_DB::table('jobs');
        $ids = $wpdb->get_col("SELECT DISTINCT j.campaign_id FROM {$wpdb->prefix}bsms_jobs j INNER JOIN {$wpdb->prefix}bsms_campaigns c ON c.id=j.campaign_id WHERE j.status_bucket='queued' AND c.status NOT IN ('queued','sending')");
        foreach ((array)$ids as $id) $wpdb->update($ct, array('status'=>'sending'), array('id'=>intval($id)));
        if ($ids && class_exists('BSMS_Security')) BSMS_Security::log('stranded_campaigns_recovered', 'Campaigns with unsent recipients returned to the sending queue', array('campaigns'=>array_map('intval', $ids)));
        return count((array)$ids);
    }

    public static function run_worker(){
        $token = self::acquire_lock();
        if (!$token) return;
        try {
            self::recover_claimed_jobs();
            self::process_queue();
            // v3.7.2: accepted messages with no failure reported become successful after the wait.
            if (class_exists('BSMS_DLR')) BSMS_DLR::finalize_no_report(true);
        } finally {
            self::release_lock($token);
        }
    }

    private static function process_queue(){
        global $wpdb;
        $ct = BSMS_DB::table('campaigns');
        $jt = BSMS_DB::table('jobs');
        $now = BSMS_Util::now_gmt();
        $started = time();

        $jobs = $wpdb->get_results($wpdb->prepare(
            "SELECT j.* FROM {$wpdb->prefix}bsms_jobs j
             JOIN {$wpdb->prefix}bsms_campaigns c ON c.id=j.campaign_id
             WHERE j.status_bucket='queued'
             AND c.status IN('queued','sending')
             AND (c.schedule_at IS NULL OR c.schedule_at <= %s)
             ORDER BY j.id ASC LIMIT 50", $now)
        );

        foreach ($jobs as $job) {
            if (time() - $started > self::TIME_BUDGET) break;
            if (!self::claim_job($job->id)) continue;
            $debit = BSMS_Wallet::debit_sms($job->user_id, $job->cost_kobo, 'JOB-' . $job->id, array('campaign_id'=>$job->campaign_id));
            if (is_wp_error($debit)) {
                // A pricing/network label may have existed on older queued jobs in
                // err_code. Never expose that metadata as a provider failure code.
                $wpdb->update($jt, array(
                    'status_bucket'=>'failed',
                    'provider_status'=>'NOT_SUBMITTED',
                    'provider_message_id'=>'',
                    'api_id'=>0,
                    'err_code'=>strtoupper($debit->get_error_code()),
                    'last_error'=>$debit->get_error_message(),
                    'sync_notes'=>__('Message was not submitted to an SMS provider because the wallet transaction could not be completed.', 'bulk-sms-portal'),
                    'sent_at'=>null,
                    'updated_at'=>$now
                ), array('id'=>$job->id));
                continue;
            }

            $recipient = $job->to_phone_e164 ?: $job->recipient;
            $message = $job->body ?: $job->message;
            $send = BSMS_Providers::send_sms($recipient, $message, $job->sender_id, $job->route, array('job_id'=>$job->id, 'campaign_id'=>$job->campaign_id, 'user_id'=>$job->user_id, 'default_cc'=>BSMS_Util::default_country($job->user_id)));

            if (is_wp_error($send)) {
                $data = $send->get_error_data();
                $provider_code = is_array($data) && !empty($data['provider_code']) ? sanitize_text_field($data['provider_code']) : 'API_FAILED';
                $provider_reason = is_array($data) && !empty($data['provider_reason']) ? sanitize_text_field($data['provider_reason']) : $send->get_error_message();
                $raw = is_array($data) && isset($data['raw']) ? (string)$data['raw'] : '';
                $not_submitted = in_array($send->get_error_code(), array('no_api','api_credentials_missing','api_credentials_empty','api_credentials_not_saved'), true);
                if (!$not_submitted && empty($data['confirmed_rejection'])) {
                    // Timeouts and unknown response codes do not prove a failure. Keep the charge
                    // and await a verified provider result instead of refunding or resending.
                    $wpdb->update($jt, array(
                        'status_bucket'=>'pending', 'provider_status'=>'UNKNOWN',
                        'err_code'=>'SEND_UNCONFIRMED',
                        'api_id'=>is_array($data) ? intval($data['api_id'] ?? $job->api_id) : intval($job->api_id),
                        'last_error'=>__('The SMS service has not confirmed whether this message was accepted. Please check the delivery result.', 'bulk-sms-portal'),
                        'sync_notes'=>__('The send response could not be confirmed. Check with the SMS service before changing the result or returning a charge.', 'bulk-sms-portal'),
                        'updated_at'=>$now,
                    ), array('id'=>$job->id));
                    continue;
                }
                // Refund/release this recipient's charge because the upstream gateway rejected/failed it.
                $refund = true;
                if (intval($job->cost_kobo) > 0) {
                    $refund = BSMS_Wallet::refund_sms_job($job->user_id, $job->id, intval($job->cost_kobo), array(
                        'campaign_id'=>$job->campaign_id,
                        'job_id'=>$job->id,
                        'reason'=>$provider_reason,
                        'provider_code'=>$provider_code,
                    ));
                }
                $wpdb->update($jt, array(
                    'status_bucket'=>'failed',
                    // v3.7.1: never sent (no SMS service, or its sign-in details are missing).
                    'provider_status'=>$not_submitted ? 'NOT_SUBMITTED' : 'FAILED',
                    'err_code'=>is_wp_error($refund) ? 'REFUND_PENDING' : $provider_code,
                    'last_error'=>$provider_reason . (is_wp_error($refund) ? __(' | Refund awaiting retry.', 'bulk-sms-portal') : '') . ($raw !== '' ? __(' | Raw: ', 'bulk-sms-portal') . substr($raw, 0, 450) : ''),
                    'updated_at'=>$now
                ), array('id'=>$job->id));
                continue;
            }

            if (is_array($send) && (($send['submission_state'] ?? '') === 'unconfirmed')) {
                $raw_note = isset($send['raw']) ? __(' | Raw: ', 'bulk-sms-portal') . substr((string)$send['raw'], 0, 450) : '';
                $operator_note = !empty($send['provider_operator']) ? __(' | Network/operator: ', 'bulk-sms-portal') . sanitize_text_field($send['provider_operator']) : '';
                $wpdb->update($jt, array(
                    'provider_message_id'=>sanitize_text_field($send['provider_message_id'] ?? ''),
                    'provider_status'=>'UNCONFIRMED',
                    'network'=>sanitize_text_field($send['provider_operator'] ?? $job->network ?? ''),
                    'err_code'=>'SEND_UNCONFIRMED',
                    'api_id'=>intval($send['api_id'] ?? $job->api_id),
                    'status_bucket'=>'pending',
                    'last_error'=>sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('The SMS service has not confirmed whether this message was accepted. No automatic resend or refund has been performed.%1$s%2$s', 'bulk-sms-portal'), $operator_note, $raw_note),
                    'sync_notes'=>__('Awaiting a verified provider/DLR result. An ambiguous provider response is not treated as a failure.', 'bulk-sms-portal'),
                    'sent_at'=>null,
                    'updated_at'=>$now,
                ), array('id'=>$job->id));
                continue;
            }

            $id_type_note = (!empty($send['provider_message_id_type']) && $send['provider_message_id_type'] === 'internal') ? __(' | Internal reference only; provider did not return message ID.', 'bulk-sms-portal') : '';
            $accepted_reason = isset($send['provider_reason']) ? $send['provider_reason'] : __('Message accepted by provider', 'bulk-sms-portal');
            $raw_note = isset($send['raw']) ? __(' | Raw: ', 'bulk-sms-portal') . substr((string)$send['raw'], 0, 450) : '';
            $api_id = isset($send['api_id']) ? intval($send['api_id']) : intval($job->api_id ?? 0);
            $dlr_lookup_url = '';
            if ($api_id > 0) {
                $apis_table = BSMS_DB::table('apis');
                $dlr_lookup_url = (string)$wpdb->get_var($wpdb->prepare("SELECT dlr_lookup_url FROM {$wpdb->prefix}bsms_apis WHERE id=%d", $api_id));
            }
            $provider_status = isset($send['provider_status']) ? sanitize_text_field($send['provider_status']) : 'AWAITING_DLR';
            $no_dlr_accepted = ($dlr_lookup_url === '' && !empty($send['provider_message_id']));
            $status_bucket = $no_dlr_accepted ? 'sent' : 'pending';
            $sync_note = $no_dlr_accepted ? (sprintf(/* translators: %s: a value filled in when shown */ __('No DLR API configured; provider accepted the message, so local status was harmonised as Sent / Provider Accepted at %s.', 'bulk-sms-portal'), $now)) : '';
            $last_error = $no_dlr_accepted
                ? sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Provider accepted/submitted the SMS. No provider DLR API is configured, so handset delivery cannot be confirmed automatically.%1$s%2$s', 'bulk-sms-portal'), $id_type_note, $raw_note)
                : $accepted_reason . $id_type_note . $raw_note;
            $wpdb->update($jt, array(
                'provider_message_id'=>$send['provider_message_id'],
                // v3.4.2: record which provider accepted the message, so delivery
                // reports can be looked up and matched to it.
                'api_id'=>$api_id,
                'provider_status'=> $provider_status,
                'network'=>sanitize_text_field($send['provider_operator'] ?? $job->network ?? ''),
                'err_code'=>isset($send['provider_code']) ? $send['provider_code'] : 'OK',
                'status_bucket'=>$status_bucket,
                'last_error'=>$last_error,
                'last_synced_at'=>$no_dlr_accepted ? $now : null,
                'sync_notes'=>$sync_note,
                'sent_at'=>$now,
                'updated_at'=>$now
            ), array('id'=>$job->id));

            // The campaign's final status is decided below once no recipients are left queued.
            $wpdb->update($ct, array('status'=>'sending'), array('id'=>$job->campaign_id, 'status'=>'queued'));
            if (class_exists('BSMS_Notifications')) BSMS_Notifications::maybe_low_balance($job->user_id);
        }

        // A provider rejection must never resend a message when a refund needs retrying.
        $pending_refunds = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}bsms_jobs WHERE status_bucket='failed' AND err_code='REFUND_PENDING' ORDER BY id ASC LIMIT 50");
        foreach ($pending_refunds as $row) {
            $refund = BSMS_Wallet::refund_sms_job($row->user_id, $row->id, $row->cost_kobo, array('campaign_id'=>$row->campaign_id, 'reason'=>__('Provider rejected message', 'bulk-sms-portal')));
            if (!is_wp_error($refund)) $wpdb->update($jt, array('err_code'=>'API_FAILED', 'updated_at'=>BSMS_Util::now_gmt()), array('id'=>$row->id, 'err_code'=>'REFUND_PENDING'));
        }

        $done = $wpdb->get_col("SELECT c.id FROM {$wpdb->prefix}bsms_campaigns c WHERE c.status IN('queued','sending') AND NOT EXISTS(SELECT 1 FROM {$wpdb->prefix}bsms_jobs j WHERE j.campaign_id=c.id AND j.status_bucket IN ('queued','sending'))");
        foreach ($done as $cid) {
            $summary = $wpdb->get_row($wpdb->prepare(
                "SELECT COUNT(*) total,
                        SUM(status_bucket='pending') pending,
                        SUM(status_bucket='sent') sent,
                        SUM(status_bucket='success') success,
                        SUM(status_bucket='failed') failed,
                        SUM(status_bucket='skipped') skipped
                 FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d",
                $cid
            ), ARRAY_A);

            $total = intval($summary['total'] ?? 0);
            $pending = intval($summary['pending'] ?? 0);
            $sent = intval($summary['sent'] ?? 0);
            $success = intval($summary['success'] ?? 0);
            $failed = intval($summary['failed'] ?? 0);
            $skipped = intval($summary['skipped'] ?? 0);

            if ($total > 0 && ($failed + $skipped) === $total) {
                $final = 'failed';
            } elseif (($success + $sent) > 0 && $failed > 0 && $pending === 0) {
                $final = 'partial';
            } elseif (($success + $sent) > 0 && $pending === 0 && $failed === 0) {
                $final = 'sent';
            } else {
                $final = 'sending';
            }

            $wpdb->update($ct, array('status'=>$final), array('id'=>$cid));
            $uid = intval($wpdb->get_var($wpdb->prepare("SELECT user_id FROM {$wpdb->prefix}bsms_campaigns WHERE id=%d", $cid)));
            if ($uid && class_exists('BSMS_Notifications') && in_array($final, array('failed','partial','sent'), true)) {
                BSMS_Notifications::campaign_summary($uid, intval($cid));
            }
        }
    }
}

add_filter('cron_schedules', function($schedules){
    if (!isset($schedules['minute'])) $schedules['minute'] = array('interval'=>60, 'display'=>'Every Minute');
    return $schedules;
});
