<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_DLR {
    public static function init(){
        add_filter('cron_schedules', array(__CLASS__, 'schedules'));
        add_action('rest_api_init', array(__CLASS__, 'routes'));
        add_action('bsms_poll_dlr', array(__CLASS__, 'poll_pending'));
        // Existing installs may have been activated before the DLR sync cadence existed.
        if (!wp_next_scheduled('bsms_poll_dlr')) {
            wp_schedule_event(time()+300, 'bsms_every_five_minutes', 'bsms_poll_dlr');
        }
    }

    public static function schedules($schedules){
        if (!isset($schedules['bsms_every_five_minutes'])) {
            $schedules['bsms_every_five_minutes'] = array('interval'=>300,'display'=>__('Every five minutes for Bulk SMS Portal DLR sync', 'bulk-sms-portal'));
        }
        return $schedules;
    }

    public static function routes(){
        register_rest_route('bsms/v1','/dlr',array('methods'=>array('GET','POST'),'callback'=>array(__CLASS__,'webhook'),'permission_callback'=>array(__CLASS__,'authorise_webhook')));
        register_rest_route('bsms/v1','/admin/dlr/sync',array('methods'=>'POST','callback'=>array(__CLASS__,'manual_sync'),'permission_callback'=>function(){ return class_exists('BSMS_REST') && BSMS_REST::can_manage_platform(); }));
        register_rest_route('bsms/v1','/admin/dlr/diagnostics',array('methods'=>'GET','callback'=>array(__CLASS__,'diagnostics'),'permission_callback'=>function(){ return class_exists('BSMS_REST') && BSMS_REST::can_manage_platform(); }));
    }

    public static function authorise_webhook(WP_REST_Request $request){
        if (class_exists('BSMS_Security') && BSMS_Security::verify_dlr_request($request)) return true;
        return new WP_Error('bsms_dlr_forbidden', __('Delivery update could not be verified.', 'bulk-sms-portal'), array('status'=>403));
    }

    public static function webhook(WP_REST_Request $request){
        // Check again for direct callers as well as the REST permission callback.
        $authorised = self::authorise_webhook($request);
        if (is_wp_error($authorised)) return $authorised;
        $params = array_merge((array)$request->get_query_params(), (array)$request->get_body_params(), (array)$request->get_json_params());
        // A callback token is a credential: never put it into delivery event history.
        foreach (array_keys($params) as $key) {
            if (in_array(strtolower((string)$key), array('token','x-bsms-dlr-token'), true)) unset($params[$key]);
        }
        $provider_message_id = sanitize_text_field($params['messageid'] ?? $params['MessageID'] ?? $params['messageId'] ?? $params['sMessageId'] ?? $params['message_id'] ?? $params['provider_message_id'] ?? $params['msgid'] ?? $params['id'] ?? '');
        $raw_status = $params['status'] ?? $params['delivery_status'] ?? $params['dlr_status'] ?? $params['sStatus'] ?? $params['Status'] ?? $params['provider_status'] ?? '';
        $job_id = absint($params['job_id'] ?? $params['client_ref'] ?? $params['reference'] ?? 0);
        if (trim((string)$raw_status) === '' || (!$provider_message_id && !$job_id)) {
            return new WP_Error('bsms_dlr_invalid', __('Delivery update is missing a recognised result or message reference.', 'bulk-sms-portal'), array('status'=>400));
        }
        global $wpdb;
        $jobs = BSMS_DB::table('jobs');
        $auth = class_exists('BSMS_Security') ? BSMS_Security::dlr_auth($request) : array('legacy'=>true,'api_id'=>0);
        // v3.4.2: the old shared token may only update a message identified by
        // the provider's own message ID; sequential job numbers alone are not enough.
        if (!empty($auth['legacy']) && ($provider_message_id === '' || stripos($provider_message_id, 'LOCAL-') === 0)) {
            return new WP_Error('bsms_dlr_reference_required', __('Delivery updates on the shared URL must include the provider message ID. Use the provider-specific delivery URL instead.', 'bulk-sms-portal'), array('status'=>403));
        }
        if ($provider_message_id && $job_id) {
            $job = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_jobs WHERE id=%d AND provider_message_id=%s LIMIT 1", $job_id, $provider_message_id));
        } elseif ($job_id) {
            $job = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_jobs WHERE id=%d LIMIT 1", $job_id));
        } else {
            $matches = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_jobs WHERE provider_message_id=%s LIMIT 2", $provider_message_id));
            if (count((array)$matches) > 1) return new WP_Error('bsms_dlr_ambiguous', __('More than one message matches this delivery update.', 'bulk-sms-portal'), array('status'=>409));
            $job = $matches[0] ?? null;
        }
        if (!$job) return new WP_Error('bsms_dlr_not_found', __('No message matches this delivery update.', 'bulk-sms-portal'), array('status'=>404));
        // A provider-specific token only covers that provider's messages.
        if (!empty($auth['api_id']) && intval($job->api_id) !== intval($auth['api_id'])) {
            return new WP_Error('bsms_dlr_not_found', __('No message matches this delivery update.', 'bulk-sms-portal'), array('status'=>404));
        }
        $apis = BSMS_DB::table('apis');
        $api = !empty($job->api_id) ? $wpdb->get_row($wpdb->prepare("SELECT dlr_success_codes, dlr_failure_codes FROM {$wpdb->prefix}bsms_apis WHERE id=%d", intval($job->api_id))) : null;
        $status = self::provider_delivery_status($raw_status, $api);
        if (!in_array($status, array('delivered','failed','pending'), true)) {
            return new WP_Error('bsms_dlr_unknown', __('This provider’s delivery result is not recognised. Review its code settings.', 'bulk-sms-portal'), array('status'=>422));
        }
        $campaign_id = intval($job->campaign_id);
        if (!empty($params['campaign_id']) && intval($params['campaign_id']) !== $campaign_id) {
            return new WP_Error('bsms_dlr_mismatch', __('Delivery update does not match this message.', 'bulk-sms-portal'), array('status'=>409));
        }
        $previous = (string)$job->status_bucket;
        // An older provider callback must not erase a final result.
        if (in_array($previous, array('success','failed'), true) && $status === 'pending') {
            return array('ok'=>true,'status'=>$previous,'updated'=>false);
        }
        self::record($campaign_id, intval($job->id), $provider_message_id, $status, $params);
        $applied = self::apply_status_to_job($job, $status, $params, 'webhook');
        if (is_wp_error($applied)) return $applied;
        return array('ok'=>true,'status'=>$status,'campaign_id'=>$campaign_id,'provider_message_id'=>$provider_message_id,'updated'=>true);
    }

    public static function manual_sync(WP_REST_Request $request){
        $limit = intval($request->get_param('limit') ?: 50);
        $out = self::poll_pending($limit, true);
        return array('ok'=>true) + $out;
    }

    public static function diagnostics(){
        global $wpdb;
        $jobs = BSMS_DB::table('jobs');
        $apis = BSMS_DB::table('apis');
        $pending = intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_jobs WHERE status_bucket='pending'"));
        $with_lookup = intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_apis WHERE is_active=1 AND dlr_lookup_url IS NOT NULL AND dlr_lookup_url<>''"));
        return array(
            'ok'=>true,
            'cron_scheduled'=>(bool)wp_next_scheduled('bsms_poll_dlr'),
            'next_cron'=>wp_next_scheduled('bsms_poll_dlr') ? gmdate('Y-m-d H:i:s', wp_next_scheduled('bsms_poll_dlr')) : '',
            'last_sync'=>get_option('bsms_dlr_last_sync_at',''),
            'last_result'=>get_option('bsms_dlr_last_result', array()),
            'pending_dlr'=>$pending,
            'apis_with_lookup_url'=>$with_lookup,
            'webhook_url'=>class_exists('BSMS_Security') ? BSMS_Security::dlr_callback_url() : rest_url('bsms/v1/dlr'),
            'provider_webhook_urls'=>array_map(function($api){ return array('api_id'=>intval($api->id), 'name'=>(string)$api->name, 'url'=>BSMS_Security::dlr_callback_url(intval($api->id))); }, class_exists('BSMS_Providers') ? BSMS_Providers::all_apis() : array()),
        );
    }

    /** Match numeric provider codes only against that provider's own saved lists. */
    public static function provider_delivery_status($raw_status, $api=null){
        $raw = trim((string)$raw_status);
        if ($raw === '') return 'unknown';
        // Many gateways append explanatory text after a numeric result code.
        $code = preg_match('/^([0-9]+)(?:[|:;\s].*)?$/', $raw, $match) ? $match[1] : $raw;
        $success = self::code_in_list($code, $api->dlr_success_codes ?? '');
        $failure = self::code_in_list($code, $api->dlr_failure_codes ?? '');
        if ($success && $failure) return 'unknown';
        if ($failure) return 'failed';
        if ($success) return 'delivered';
        if (preg_match('/^[0-9]+$/', $code)) return 'unknown';
        $status = self::normalise_status($raw);
        return in_array($status, array('delivered','failed','pending'), true) ? $status : 'unknown';
    }

    private static function code_in_list($code, $list){
        foreach (preg_split('/[|,\r\n]+/', (string)$list, -1, PREG_SPLIT_NO_EMPTY) as $item) {
            if (strcasecmp(trim($item), $code) === 0) return true;
        }
        return false;
    }

    public static function delivery_code_lists_overlap($success_codes, $failure_codes){
        foreach (preg_split('/[|,\r\n]+/', (string)$success_codes, -1, PREG_SPLIT_NO_EMPTY) as $code) {
            if (self::code_in_list(trim($code), $failure_codes)) return true;
        }
        return false;
    }

    public static function normalise_status($status){
        $s = strtolower(trim((string)$status));
        $s = str_replace(array(' ', '-'), '_', $s);
        if (in_array($s, array('delivered','deliverd','dlvrd','delivrd','successful','completed','complete','done','deliv','delivered_to_handset'), true)) return 'delivered';
        if (in_array($s, array('failed','fail','undelivered','undeliv','rejected','expired','blocked','not_delivered','bounced','error','cancelled','canceled'), true)) return 'failed';
        if (in_array($s, array('queued','pending','accepted','submitted','processing','in_progress','awaiting_dlr','sent','ok','success'), true)) return 'pending';
        return $s ?: 'unknown';
    }

    private static function provider_acceptance_status($provider_status){
        $ps = strtoupper(trim((string)$provider_status));
        return in_array($ps, array('SUBMITTED','ACCEPTED','OK','SUCCESS','SENT','AWAITING_DLR','PENDING','DELIVERED'), true);
    }

    private static function harmonise_no_dlr_acceptance($row, $source='no_dlr_fallback'){
        global $wpdb;
        $jobs = BSMS_DB::table('jobs');
        $now = BSMS_Util::now_gmt();
        $provider_status = strtoupper(trim((string)($row->provider_status ?? '')));
        if ($provider_status === '') $provider_status = 'SUBMITTED';
        $wpdb->update($jobs, array(
            'status_bucket' => 'sent',
            'provider_status' => $provider_status,
            'last_error' => __('Provider accepted/submitted the SMS. No provider DLR API is configured, so handset delivery cannot be confirmed automatically.', 'bulk-sms-portal'),
            'last_synced_at' => $now,
            'sync_notes' => sprintf(/* translators: %s: a value filled in when shown */ __('No DLR API configured; provider accepted the message, so local status was harmonised as Sent / Provider Accepted at %s.', 'bulk-sms-portal'), $now),
            'updated_at' => $now,
        ), array('id'=>intval($row->id)));
        self::record(intval($row->campaign_id), intval($row->id), (string)($row->provider_message_id ?? ''), 'sent_no_dlr', array(
            'provider'=>(string)($row->api_name ?? ''),
            'provider_status'=>$provider_status,
            'source'=>$source,
            'note'=>__('No DLR API configured; provider accepted message.', 'bulk-sms-portal'),
        ));
        self::refresh_campaign_statuses(intval($row->campaign_id));
    }

    public static function record($campaign_id, $job_id, $provider_message_id, $status, $payload){
        global $wpdb;
        $wpdb->insert(BSMS_DB::table('dlr_events'), array(
            'campaign_id'=>intval($campaign_id),
            'job_id'=>intval($job_id),
            'provider_message_id'=>sanitize_text_field($provider_message_id),
            'provider'=>sanitize_text_field($payload['provider'] ?? $payload['api_name'] ?? ''),
            'delivery_status'=>sanitize_text_field($status),
            'raw_payload'=>wp_json_encode($payload),
            'created_at'=>BSMS_Util::now_gmt()
        ));
    }

    /**
     * v3.7.2 rule (owner decision): a message the SMS service accepted counts
     * as successful unless the service reports it failed. After the wait set
     * in Platform Settings (default 1 hour) it is marked successful
     * ("NO_FAILURE_REPORTED"). A failure reported later still overrides it
     * and returns the charge (apply_status_to_job).
     */
    public static function success_after_minutes(){
        $m = get_option('bsms_success_after_minutes', 60);
        return max(0, min(1440, intval($m)));
    }
    public static function finalize_no_report($throttle = false){
        global $wpdb;
        if ($throttle) { if (get_transient('bsms_finalize_ran')) return 0; set_transient('bsms_finalize_ran', 1, 60); }
        $jobs = BSMS_DB::table('jobs');
        $now = BSMS_Util::now_gmt();
        $cut = gmdate('Y-m-d H:i:s', time() - self::success_after_minutes() * 60);
        // Accepted messages ('sent'), and waiting ones the service did accept. A send
        // whose acceptance was never confirmed (timeout) waits for the 72-hour rule.
        $where = "(status_bucket IN ('sent','accepted','submitted') OR (status_bucket='pending' AND (err_code IS NULL OR err_code<>'SEND_UNCONFIRMED')))
                  AND ((sent_at IS NOT NULL AND sent_at<>'' AND sent_at <= %s) OR provider_status='NO_FINAL_CONFIRMATION')";
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $where is a fixed SQL string defined just above; values use placeholders.
        $cids = $wpdb->get_col($wpdb->prepare("SELECT DISTINCT campaign_id FROM {$wpdb->prefix}bsms_jobs WHERE $where LIMIT 500", $cut));
        if (!$cids) return 0;
        // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- $where is a fixed SQL string defined above; values use placeholders.
        $n = intval($wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}bsms_jobs SET status_bucket='success', provider_status='NO_FAILURE_REPORTED',
                last_error='No failure was reported by the SMS service, so this message counts as successful.',
                sync_notes=%s, updated_at=%s WHERE $where", 'Counted as successful (no failure reported) at ' . $now . '.', $now, $cut)));
        // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
        foreach ($cids as $cid) self::refresh_campaign_statuses(intval($cid));
        return $n;
    }

    public static function poll_pending($limit=50, $manual=false){
        global $wpdb;
        $jobs = BSMS_DB::table('jobs');
        $apis = BSMS_DB::table('apis');
        $now = BSMS_Util::now_gmt();
        $limit = max(1, min(200, intval($limit)));
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT j.*, a.name api_name, a.api_username, a.api_password, a.auth_headers, a.dlr_lookup_url, a.dlr_status_pattern, a.success_pattern, a.failure_pattern, a.status_json_path, a.dlr_success_codes, a.dlr_failure_codes
             FROM {$wpdb->prefix}bsms_jobs j
             LEFT JOIN {$wpdb->prefix}bsms_apis a ON a.id=j.api_id
             WHERE j.status_bucket='pending'
                OR (j.status_bucket='success' AND j.provider_status='NO_FAILURE_REPORTED' AND a.dlr_lookup_url IS NOT NULL AND a.dlr_lookup_url<>'' AND j.sent_at > %s)
             ORDER BY j.updated_at ASC, j.id ASC
             LIMIT %d",
            gmdate('Y-m-d H:i:s', time() - 72 * HOUR_IN_SECONDS), $limit
        ));

        $checked = 0; $updated = 0; $skipped = 0; $errors = 0;
        foreach ($rows as $row) {
            $res = self::sync_job($row->id, $row);
            if (is_wp_error($res)) { $errors++; continue; }
            if (!empty($res['skipped'])) { $skipped++; continue; }
            $checked++;
            if (!empty($res['updated'])) $updated++;
        }

        // Do not leave provider-accepted messages active forever.
        $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->prefix}bsms_jobs SET provider_status=%s, updated_at=%s WHERE status_bucket='pending' AND sent_at IS NOT NULL AND sent_at < DATE_SUB(%s, INTERVAL 24 HOUR) AND (provider_status IS NULL OR provider_status='' OR provider_status IN('SUBMITTED','OK','SUCCESS','ACCEPTED','AWAITING_DLR','pending','PENDING'))",
            'NO_FINAL_CONFIRMATION', $now, $now
        ));
        $aged = intval($wpdb->rows_affected);

        // v3.4.2: messages whose sending result was never confirmed (provider
        // timeout, server error or an unclear reply) are closed after 72 hours
        // so campaigns can finish. The charge is kept and the result is shown
        // as "sent, not confirmed"; an admin can still mark it failed (refunds).
        $camps = BSMS_DB::table('campaigns');
        $stale_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT j.id FROM {$wpdb->prefix}bsms_jobs j INNER JOIN {$wpdb->prefix}bsms_campaigns c ON c.id=j.campaign_id
             WHERE j.status_bucket='pending' AND j.err_code='SEND_UNCONFIRMED' AND c.created_at < %s LIMIT 500",
            gmdate('Y-m-d H:i:s', time() - 72 * HOUR_IN_SECONDS)));
        foreach ((array)$stale_ids as $sid) {
            $wpdb->update($jobs, array('status_bucket'=>'success', 'provider_status'=>'NO_FAILURE_REPORTED',
                'last_error'=>__('The SMS service did not report a failure within 72 hours, so this message counts as successful; the charge was kept.', 'bulk-sms-portal'),
                'sync_notes'=>sprintf(/* translators: %s: a value filled in when shown */ __('Closed without confirmation after 72 hours at %s.', 'bulk-sms-portal'), $now), 'updated_at'=>$now), array('id'=>intval($sid), 'status_bucket'=>'pending'));
        }
        if ($stale_ids) self::refresh_campaign_statuses();
        $aged += count((array)$stale_ids);

        $aged += self::finalize_no_report();
        self::refresh_campaign_statuses();
        $result = array('checked'=>$checked,'updated'=>$updated,'skipped_no_lookup_url'=>$skipped,'errors'=>$errors,'aged_no_final_confirmation'=>$aged,'manual'=>(bool)$manual,'ran_at'=>$now);
        update_option('bsms_dlr_last_sync_at', $now, false);
        update_option('bsms_dlr_last_result', $result, false);
        if (class_exists('BSMS_Security')) BSMS_Security::log('dlr_poll_ran','DLR sync engine ran', $result);
        return $result;
    }

    public static function sync_job($job_id, $prefetched_row=null){
        global $wpdb;
        $jobs = BSMS_DB::table('jobs');
        $apis = BSMS_DB::table('apis');
        $job_id = intval($job_id);
        $row = $prefetched_row;
        if (!$row) {
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT j.*, a.name api_name, a.api_username, a.api_password, a.auth_headers, a.dlr_lookup_url, a.dlr_status_pattern, a.success_pattern, a.failure_pattern, a.status_json_path, a.dlr_success_codes, a.dlr_failure_codes
                 FROM {$wpdb->prefix}bsms_jobs j
                 LEFT JOIN {$wpdb->prefix}bsms_apis a ON a.id=j.api_id
                 WHERE j.id=%d LIMIT 1",
                $job_id
            ));
        }
        if (!$row) return new WP_Error('bsms_job_not_found', __('Delivery report row not found.', 'bulk-sms-portal'));

        $now = BSMS_Util::now_gmt();
        if (empty($row->dlr_lookup_url)) {
            $local = self::provider_delivery_status($row->provider_status ?? '', $row);
            if (in_array($local, array('delivered','failed'), true)) {
                $applied = self::apply_status_to_job($row, $local, array('provider'=>$row->api_name, 'raw_response'=>sprintf(/* translators: %s: a value filled in when shown */ __('Existing provider status: %s', 'bulk-sms-portal'), ($row->provider_status ?? '')), 'extracted_status'=>$row->provider_status ?? ''), 'harmonise');
                if (is_wp_error($applied)) return $applied;
                return array('ok'=>true,'job_id'=>$job_id,'status'=>$local,'updated'=>true,'note'=>__('Local provider status harmonised without lookup URL.', 'bulk-sms-portal'));
            }
            if (self::provider_acceptance_status($row->provider_status ?? '') || !empty($row->sent_at)) {
                self::harmonise_no_dlr_acceptance($row, 'manual_sync');
                return array('ok'=>true,'job_id'=>$job_id,'status'=>'sent_no_dlr','updated'=>true,'note'=>__('No DLR API configured; provider acceptance harmonised as Sent / Provider Accepted.', 'bulk-sms-portal'));
            }
            $wpdb->update($jobs, array('last_synced_at'=>$now, 'sync_notes'=>__('No DLR API configured and no provider acceptance was found yet.', 'bulk-sms-portal'), 'updated_at'=>$now), array('id'=>$job_id));
            return array('ok'=>true,'job_id'=>$job_id,'status'=>'skipped','updated'=>false,'skipped'=>true,'note'=>__('Provider DLR lookup URL is not configured.', 'bulk-sms-portal'));
        }

        $res = self::lookup_job_status($row);
        if (is_wp_error($res)) {
            $wpdb->update($jobs, array('last_synced_at'=>$now, 'sync_notes'=>sprintf(/* translators: %s: a value filled in when shown */ __('Lookup error: %s', 'bulk-sms-portal'), $res->get_error_message()), 'updated_at'=>$now), array('id'=>$job_id));
            self::record($row->campaign_id, $row->id, $row->provider_message_id, 'lookup_error', array('error'=>$res->get_error_message(),'provider'=>$row->api_name));
            return $res;
        }
        $status = !empty($res['status']) ? $res['status'] : 'unknown';
        if ($status !== 'unknown') {
            $applied = self::apply_status_to_job($row, $status, $res['payload'], 'manual_sync');
            if (is_wp_error($applied)) return $applied;
        } else {
            $wpdb->update($jobs, array('last_synced_at'=>$now, 'sync_notes'=>__('Provider lookup returned no recognisable final status.', 'bulk-sms-portal'), 'updated_at'=>$now), array('id'=>$job_id));
        }
        return array('ok'=>true,'job_id'=>$job_id,'status'=>$status,'updated'=>in_array($status, array('delivered','failed'), true),'payload'=>$res['payload']);
    }

    public static function lookup_job_status($row){
        $payload = array(
            'username'=>self::credential($row, 'username'),
            'password'=>self::credential($row, 'password'),
            'api_username'=>self::credential($row, 'username'),
            'api_password'=>self::credential($row, 'password'),
            'message_id'=>(string)$row->provider_message_id,
            'provider_message_id'=>(string)$row->provider_message_id,
            'job_id'=>intval($row->id),
            'campaign_id'=>intval($row->campaign_id),
            'recipient'=>(string)($row->to_phone_e164 ?: $row->recipient),
            'phone'=>(string)($row->to_phone_e164 ?: $row->recipient),
            'sender'=>(string)$row->sender_id,
            'route'=>(string)$row->route,
        );
        $url = BSMS_Providers::replace_placeholders((string)$row->dlr_lookup_url, $payload, 'url');
        $url = self::encode_url_query_values($url);
        $headers = BSMS_Providers::fill_header_credentials(self::parse_headers($row->auth_headers), $row);
        $response = wp_remote_get($url, array('headers'=>$headers,'timeout'=>25,'redirection'=>2));
        if (is_wp_error($response)) return $response;
        $body = trim((string)wp_remote_retrieve_body($response));
        $http = intval(wp_remote_retrieve_response_code($response));
        if ($http < 200 || $http >= 300) return new WP_Error('dlr_lookup_unavailable', __('The SMS service has not confirmed a result. Please try again later.', 'bulk-sms-portal'));
        $decoded = json_decode($body, true);
        $raw_status = self::extract_status($row, $body, $decoded);
        $status = self::provider_delivery_status($raw_status, $row);
        $payload['provider'] = $row->api_name;
        $payload['http_code'] = $http;
        $payload['raw_response'] = self::shorten($body, 1200);
        $payload['extracted_status'] = $raw_status;
        $payload['lookup_url'] = self::redact_url($url);
        return array('status'=>$status, 'payload'=>$payload);
    }

    public static function apply_status_to_job($job, $status, $payload=array(), $source='dlr'){
        global $wpdb;
        $jobs = BSMS_DB::table('jobs');
        $now = BSMS_Util::now_gmt();
        $status = self::normalise_status($status);
        if ($status === 'pending' && in_array((string)($job->status_bucket ?? ''), array('success','failed'), true)) return;
        $ledger = BSMS_DB::table('ledger');
        $refund_ref = 'REFUND-JOB-' . intval($job->id);
        if ($status === 'delivered' && $wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bsms_ledger WHERE reference=%s LIMIT 1", $refund_ref))) {
            return new WP_Error('delivery_after_refund', __('This message was already refunded. Please review the conflicting delivery update.', 'bulk-sms-portal'), array('status'=>409));
        }
        $refund_result = null;
        if ($status === 'failed') {
            $charge = $wpdb->get_row($wpdb->prepare("SELECT user_id, amount_kobo FROM {$wpdb->prefix}bsms_ledger WHERE reference=%s AND type='sms_charge' LIMIT 1", 'JOB-' . intval($job->id)));
            if ($charge && (intval($charge->user_id) !== intval($job->user_id) || intval($charge->amount_kobo) !== -intval($job->cost_kobo))) {
                return new WP_Error('charge_mismatch', __('This message charge needs review before its result can be updated.', 'bulk-sms-portal'), array('status'=>409));
            }
            if ($charge && intval($charge->user_id) === intval($job->user_id) && intval($charge->amount_kobo) === -intval($job->cost_kobo)) {
                $refund_result = BSMS_Wallet::refund_sms_job($job->user_id, $job->id, $job->cost_kobo, array('campaign_id'=>$job->campaign_id,'reason'=>__('Confirmed failed message', 'bulk-sms-portal'),'source'=>$source));
                if (is_wp_error($refund_result)) return $refund_result;
            }
        }
        $data = array('provider_status'=>strtoupper($status), 'last_synced_at'=>$now, 'sync_notes'=>sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Synced via %1$s at %2$s', 'bulk-sms-portal'), sanitize_text_field($source), $now), 'updated_at'=>$now);
        if ($status === 'delivered') {
            $data['status_bucket'] = 'success';
            $data['delivered_at'] = $now;
            $data['last_error'] = __('Delivery confirmed by provider DLR.', 'bulk-sms-portal');
            $data['sync_notes'] = sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Provider confirmed delivery via %1$s at %2$s.', 'bulk-sms-portal'), sanitize_text_field($source), $now);
        } elseif ($status === 'failed') {
            $data['status_bucket'] = 'failed';
            $data['err_code'] = $refund_result === true ? 'DLR_FAILED_REFUNDED' : 'DLR_FAILED_UNCHARGED';
            $data['last_error'] = $refund_result === true ? __('The SMS service reported a failed message. The charge was returned to the wallet.', 'bulk-sms-portal') : __('The SMS service reported a failed message. No wallet charge was found.', 'bulk-sms-portal');
            $data['sync_notes'] = sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Provider confirmed non-delivery via %1$s at %2$s.', 'bulk-sms-portal'), sanitize_text_field($source), $now);
        } elseif ($status === 'pending') {
            $data['status_bucket'] = 'pending';
            $data['last_error'] = __('Provider accepted SMS; awaiting final delivery report.', 'bulk-sms-portal');
            $data['sync_notes'] = sprintf(/* translators: %s: a value filled in when shown */ __('Provider still reports pending/accepted at %s.', 'bulk-sms-portal'), $now);
        } else {
            $data['provider_status'] = strtoupper($status ?: 'UNKNOWN');
        }
        if (!empty($payload['raw_response'])) {
            if (!isset($data['last_error'])) $data['last_error'] = __('DLR status update.', 'bulk-sms-portal');
            $data['last_error'] .= __(' | DLR raw: ', 'bulk-sms-portal') . self::shorten($payload['raw_response'], 300);
        }
        $wpdb->update($jobs, $data, array('id'=>intval($job->id)));
        self::refresh_campaign_statuses(intval($job->campaign_id));
    }

    private static function refresh_campaign_statuses($campaign_id=0){
        global $wpdb;
        $ct = BSMS_DB::table('campaigns');
        $jt = BSMS_DB::table('jobs');
        $ids = $campaign_id ? array($campaign_id) : $wpdb->get_col("SELECT DISTINCT campaign_id FROM {$wpdb->prefix}bsms_jobs WHERE status_bucket IN('pending','sent','success','failed') ORDER BY campaign_id DESC LIMIT 300");
        foreach ($ids as $cid) {
            $summary = $wpdb->get_row($wpdb->prepare("SELECT COUNT(*) total, SUM(status_bucket='pending') pending, SUM(status_bucket='sent') sent, SUM(status_bucket='success') success, SUM(status_bucket='failed') failed, SUM(status_bucket='skipped') skipped FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d", intval($cid)), ARRAY_A);
            $total = intval($summary['total'] ?? 0); $pending=intval($summary['pending'] ?? 0); $sent=intval($summary['sent'] ?? 0); $success=intval($summary['success'] ?? 0); $failed=intval($summary['failed'] ?? 0); $skipped=intval($summary['skipped'] ?? 0);
            if ($total <= 0) continue;
            if ($pending > 0) $final = 'sending';
            elseif (($success + $sent) > 0 && $failed > 0) $final = 'partial';
            elseif (($success + $sent) > 0 && $failed === 0) $final = 'sent';
            elseif (($failed + $skipped) >= $total) $final = 'failed';
            else $final = 'sent';
            $wpdb->update($ct, array('status'=>$final), array('id'=>intval($cid)));
        }
    }

    private static function extract_status($api, $body, $decoded){
        $pattern = trim((string)($api->dlr_status_pattern ?: $api->status_json_path));
        if ($pattern !== '' && is_array($decoded)) {
            $v = self::json_path($decoded, $pattern);
            if ($v !== null && $v !== '') return (string)$v;
        }
        if ($pattern !== '') {
            $regex = self::normalise_regex($pattern);
            if ($regex && @preg_match($regex, $body, $m) && isset($m[1])) return (string)$m[1];
        }
        if (is_array($decoded)) {
            $v = self::find_first_key($decoded, array('status','delivery_status','dlr_status','state','report','sStatus',__('Status', 'bulk-sms-portal')));
            if ($v !== null && !is_array($v)) return (string)$v;
        }
        if (preg_match('/\b(DELIVRD|DELIVERED|SUCCESS|SENT|FAILED|UNDELIV|UNDELIVERED|REJECTED|EXPIRED|PENDING|SUBMITTED|ACCEPTED)\b/i', $body, $m)) return $m[1];
        return '';
    }

    private static function credential($api, $which){
        $value = $which === 'username' ? ($api->api_username ?? '') : ($api->api_password ?? '');
        return trim((string)$value);
    }

    /** Extra headers, saved as JSON or as "Name: value" lines. */
    private static function parse_headers($json){
        $headers = array();
        $extra = json_decode((string)$json, true);
        if (is_array($extra)) {
            foreach ($extra as $k=>$v) $headers[sanitize_text_field($k)] = (string)$v;
            return $headers;
        }
        foreach (preg_split('/\r\n|\r|\n/', (string)$json) as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, ':') === false) continue;
            list($k, $v) = array_map('trim', explode(':', $line, 2));
            if ($k !== '' && preg_match('/^[A-Za-z0-9-]+$/', $k)) $headers[$k] = $v;
        }
        return $headers;
    }

    private static function encode_url_query_values($url){
        $parts = wp_parse_url($url);
        if (!$parts || empty($parts['query'])) return $url;
        parse_str($parts['query'], $query);
        $encoded = array();
        foreach ($query as $k=>$v) $encoded[] = rawurlencode((string)$k) . '=' . rawurlencode(is_array($v) ? implode(',', $v) : (string)$v);
        $scheme = isset($parts['scheme']) ? $parts['scheme'] . '://' : '';
        $auth = '';
        if (isset($parts['user'])) $auth = $parts['user'] . (isset($parts['pass']) ? ':' . $parts['pass'] : '') . '@';
        $host = $parts['host'] ?? '';
        $port = isset($parts['port']) ? ':' . $parts['port'] : '';
        $path = $parts['path'] ?? '';
        $fragment = isset($parts['fragment']) ? '#' . rawurlencode($parts['fragment']) : '';
        return $scheme . $auth . $host . $port . $path . '?' . implode('&', $encoded) . $fragment;
    }

    private static function json_path($data, $path){
        if (!is_array($data) || trim((string)$path) === '') return null;
        $cur = $data;
        foreach (explode('.', trim((string)$path)) as $p) {
            if ($p === '') continue;
            if (is_array($cur) && array_key_exists($p, $cur)) $cur = $cur[$p];
            elseif (is_array($cur) && ctype_digit($p) && array_key_exists(intval($p), $cur)) $cur = $cur[intval($p)];
            else return null;
        }
        return is_array($cur) ? wp_json_encode($cur) : $cur;
    }

    private static function find_first_key($arr, $keys){
        foreach ($keys as $k) if (is_array($arr) && array_key_exists($k, $arr)) return $arr[$k];
        if (is_array($arr)) foreach ($arr as $v) if (is_array($v)) { $found = self::find_first_key($v, $keys); if ($found !== null) return $found; }
        return null;
    }

    private static function normalise_regex($pattern){
        $pattern = trim((string)$pattern);
        if ($pattern === '') return '';
        if (preg_match('/^([^A-Za-z0-9\s]).+\1[imsxuADSUXJ]*$/', $pattern)) return $pattern;
        return '/' . str_replace('/', '\/', $pattern) . '/i';
    }

    private static function redact_url($url){
        $url = preg_replace('/((?:password|pass)=)[^&\s]+/i', '$1***', (string)$url);
        $url = preg_replace('/((?:username|user)=)[^&\s]+/i', '$1***', $url);
        return self::shorten($url, 1000);
    }

    private static function shorten($text, $len=300){
        $text = trim((string)$text);
        return strlen($text) > $len ? substr($text, 0, $len) . '...' : $text;
    }
}
