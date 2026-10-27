<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Public_API {
    public static function init(){
        add_action('init', array(__CLASS__, 'rewrite_rules'));
        add_action('init', array(__CLASS__, 'maybe_refresh_rewrite_rules'), 99);
        add_filter('query_vars', array(__CLASS__, 'query_vars'));
        add_action('template_redirect', array(__CLASS__, 'dispatch'), 0); // v3.6.1: before WordPress adds a trailing slash with a redirect
    }

    public static function activate(){
        self::rewrite_rules();
        flush_rewrite_rules();
    }

    public static function deactivate(){
        flush_rewrite_rules();
    }

    public static function rewrite_rules(){
        // Canonical simple integration endpoints (v3.2.39.9).
        add_rewrite_rule('^api/send/?$', 'index.php?bsms_public_api=send', 'top');
        add_rewrite_rule('^api/balance/?$', 'index.php?bsms_public_api=balance', 'top');
        add_rewrite_rule('^api/status/?$', 'index.php?bsms_public_api=status', 'top');

        // Legacy gateway paths remain active for backward compatibility.
        add_rewrite_rule('^bulksms/bulksms/?$', 'index.php?bsms_public_api=send', 'top');
        add_rewrite_rule('^bulksms/sendmessage/?$', 'index.php?bsms_public_api=send', 'top');
        add_rewrite_rule('^bulksms/checkcredits/?$', 'index.php?bsms_public_api=balance', 'top');
        add_rewrite_rule('^CreditCheck/checkcredits/?$', 'index.php?bsms_public_api=balance', 'top');
        add_rewrite_rule('^bulksms/checkstatus/?$', 'index.php?bsms_public_api=status', 'top');
    }

    public static function maybe_refresh_rewrite_rules(){
        $rewrite_version = (string)get_option('bsms_public_api_rewrite_version', '');
        if ($rewrite_version === BSMS_PRO_VERSION) return;
        // Rules have already been registered on init. A one-time soft flush makes
        // newly introduced /api/* paths live after an overwrite upgrade without
        // requiring the administrator to re-save Permalinks manually.
        flush_rewrite_rules(false);
        update_option('bsms_public_api_rewrite_version', BSMS_PRO_VERSION, false);
    }

    public static function query_vars($vars){
        $vars[] = 'bsms_public_api';
        return $vars;
    }

    public static function dispatch(){
        $action = get_query_var('bsms_public_api');
        if (!$action) return;

        nocache_headers();
        header('Content-Type: application/json; charset=utf-8');
        header('X-Robots-Tag: noindex, nofollow', true);

        try {
            if ($action === 'send') self::send();
            if ($action === 'balance') self::balance();
            if ($action === 'status') self::status();
        } catch (Throwable $e) {
            self::fail(__('Server error', 'bulk-sms-portal'), array('debug'=>defined('WP_DEBUG') && WP_DEBUG ? $e->getMessage() : null));
        }
        exit;
    }

    public static function param($key, $fallback=''){
        // phpcs:disable WordPress.Security.NonceVerification.Recommended -- API requests are signed in with an API key, not a browser nonce.
        if (!isset($_REQUEST[$key]) || is_array($_REQUEST[$key])) return $fallback;
        return sanitize_text_field(wp_unslash($_REQUEST[$key]));
        // phpcs:enable WordPress.Security.NonceVerification.Recommended
    }

    public static function credential_param($key, $fallback=''){
        // Passwords must not be text-sanitised because doing so can change valid
        // WordPress password characters. The value is used only for verification.
        // phpcs:disable WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- API key/password sign-in; the value is only compared, never stored or shown.
        if (!isset($_REQUEST[$key]) || is_array($_REQUEST[$key])) return $fallback;
        return (string) wp_unslash($_REQUEST[$key]);
        // phpcs:enable WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
    }

    public static function message_param($key, $fallback=''){
        // phpcs:disable WordPress.Security.NonceVerification.Recommended -- API requests are signed in with an API key, not a browser nonce.
        if (!isset($_REQUEST[$key]) || is_array($_REQUEST[$key])) return $fallback;
        return sanitize_textarea_field(wp_unslash($_REQUEST[$key]));
        // phpcs:enable WordPress.Security.NonceVerification.Recommended
    }

    public static function code_for_error($message='', $internal=''){
        $key = strtolower((string)$internal.' '.(string)$message);
        if (strpos($key,'credential')!==false || strpos($key,'username')!==false || strpos($key,'password')!==false) return 'NS2001';
        if (strpos($key,'sender')!==false) return 'NS2002';
        if (strpos($key,'recipient')!==false || strpos($key,'destination')!==false || strpos($key,'number')!==false) return 'NS2003';
        if (strpos($key,'message')!==false && strpos($key,'message id')===false) return 'NS2004';
        if (strpos($key,'balance')!==false) return 'NS2005';
        if (strpos($key,'rate limit')!==false) return 'NS2008';
        if (strpos($key,'not found')!==false) return 'NS2009';
        if (strpos($key,'suspend')!==false || strpos($key,'not enabled')!==false || strpos($key,'not permitted')!==false) return 'NS2010';
        return 'NS9000';
    }

    public static function ok($data=array()){
        if (!isset($data['code'])) $data['code']='NS1000';
        echo wp_json_encode(array_merge(array('status'=>'OK'), $data));
        exit;
    }

    public static function fail($message, $extra=array()){
        $internal = isset($extra['internal_code']) ? (string)$extra['internal_code'] : (isset($extra['code']) ? (string)$extra['code'] : '');
        unset($extra['internal_code']);
        if (!isset($extra['code']) || !preg_match('/^NS\d{4}$/', (string)$extra['code'])) $extra['code']=self::code_for_error($message,$internal);
        $data = array_merge(array('status'=>'FAILED','message'=>$message), array_filter($extra, function($v){ return $v !== null; }));
        echo wp_json_encode($data);
        exit;
    }

    public static function authenticate(){
        $username = self::param('username');
        $password = self::credential_param('password');

        // v3.6.1: on a site that uses https, API keys and passwords are only
        // accepted over https, so they can't be read on the way. Hosts with an
        // unusual proxy set-up can turn this off with the
        // bsms_api_require_https filter.
        $site_https = strpos((string)home_url('/'), 'https://') === 0;
        if ($site_https && apply_filters('bsms_api_require_https', true) && class_exists('BSMS_Security') && !BSMS_Security::request_is_https()) {
            self::fail('Use https:// for API requests. Your key or password was not accepted over an insecure connection.', array('code'=>'NS2001'));
        }

        // Preferred for new integrations: a revocable Bearer API key. Keys are
        // stored hashed and can be revoked without changing the account password.
        $auth_header = '';
        if (BSMS_Util::server_value('HTTP_AUTHORIZATION') !== '') $auth_header = trim(BSMS_Util::server_value('HTTP_AUTHORIZATION'));
        elseif (BSMS_Util::server_value('REDIRECT_HTTP_AUTHORIZATION') !== '') $auth_header = trim(BSMS_Util::server_value('REDIRECT_HTTP_AUTHORIZATION'));
        if ($auth_header && preg_match('/^Bearer\s+(.+)$/i', $auth_header, $m) && class_exists('BSMS_API')) {
            $plain_key = trim((string)$m[1]);
            $prefix = BSMS_API::prefix($plain_key);
            global $wpdb;
            $keys = BSMS_DB::table('api_keys');
            $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_api_keys WHERE key_prefix=%s AND status='active'", $prefix));
            foreach ((array)$rows as $row) {
                if (!empty($row->key_hash) && wp_check_password($plain_key, $row->key_hash)) {
                    $uid = intval($row->user_id);
                    if ((string)get_user_meta($uid, 'bsms_account_status', true) === 'suspended') self::fail(__('Account is suspended', 'bulk-sms-portal'));
                    if (class_exists('BSMS_Entitlements') && !BSMS_Entitlements::is_enabled('api_access', $uid)) self::fail(__('API access is not enabled for this account', 'bulk-sms-portal'));
                    $ip_check = BSMS_API::check_ip($row, BSMS_API::client_ip());
                    if (is_wp_error($ip_check)) self::fail($ip_check->get_error_message(), array('internal_code'=>$ip_check->get_error_code()));
                    $limit_check = BSMS_API::check_rate_limit($row);
                    if (is_wp_error($limit_check)) self::fail($limit_check->get_error_message(), array('internal_code'=>$limit_check->get_error_code()));
                    $wpdb->update($keys, array('last_used_at'=>BSMS_Util::now_gmt()), array('id'=>intval($row->id)));
                    BSMS_API::log($uid, intval($row->id), '/api/'.sanitize_key((string)get_query_var('bsms_public_api')), strtoupper(BSMS_Util::server_value('REQUEST_METHOD', 'GET')), 200, true, 'API key authenticated', array(), array());
                    $row->api_username = get_userdata($uid)->user_login ?? ('user'.$uid);
                    $row->auth_mode = 'api_key';
                    return $row;
                }
            }
            self::fail(__('Invalid API Credentials', 'bulk-sms-portal'));
        }

        // Existing integrations may continue using HTTPS Basic Authorization with
        // the normal account username/email and password. Legacy query parameters
        // remain accepted so existing integrations are not broken by upgrade.
        $auth_header = '';
        if (BSMS_Util::server_value('HTTP_AUTHORIZATION') !== '') $auth_header = trim(BSMS_Util::server_value('HTTP_AUTHORIZATION'));
        elseif (BSMS_Util::server_value('REDIRECT_HTTP_AUTHORIZATION') !== '') $auth_header = trim(BSMS_Util::server_value('REDIRECT_HTTP_AUTHORIZATION'));
        if ($auth_header && stripos($auth_header, 'Basic ') === 0) {
            $decoded = base64_decode(substr($auth_header, 6), true);
            if ($decoded !== false && strpos($decoded, ':') !== false) {
                list($header_user, $header_pass) = explode(':', $decoded, 2);
                if ($header_user !== '' && $header_pass !== '') {
                    $username = sanitize_text_field($header_user);
                    $password = (string)$header_pass;
                }
            }
        }

        if (!$username || !$password) self::fail(__('Missing username or password', 'bulk-sms-portal'));

        if (class_exists('BSMS_Security')) {
            $rate_key = BSMS_Security::ip() . '|' . strtolower($username) . '|public_api';
            if (!BSMS_Security::throttle($rate_key, intval(get_option('bsms_api_rate_limit_per_minute', 60)), 60)) {
                BSMS_Security::log('public_api_rate_limited','Public API rate limit exceeded', array('username'=>$username));
                self::fail(__('Rate limit exceeded', 'bulk-sms-portal'));
            }
        }

        // v3.4.1: lock out repeated wrong passwords per account, not just per IP,
        // so passwords cannot be guessed by spreading attempts across addresses.
        $fail_ip_key = 'bsms_api_fail_' . md5(strtolower($username) . '|' . (class_exists('BSMS_Security') ? BSMS_Security::ip() : ''));
        $fail_user_key = 'bsms_api_fail_' . md5(strtolower($username));
        if (intval(get_transient($fail_ip_key)) >= 10 || intval(get_transient($fail_user_key)) >= 50) {
            self::fail(__('Too many failed sign-in attempts. Please try again in 15 minutes.', 'bulk-sms-portal'), array('code'=>'NS2008'));
        }
        $record_failure = function() use ($fail_ip_key, $fail_user_key){
            foreach (array($fail_ip_key, $fail_user_key) as $k) set_transient($k, intval(get_transient($k)) + 1, 15 * MINUTE_IN_SECONDS);
        };

        // Account credentials are API credentials: no separate generation step.
        $user = get_user_by('login', $username);
        if (!$user && is_email($username)) $user = get_user_by('email', $username);
        if ($user && wp_check_password($password, $user->user_pass, $user->ID)) {
            $uid = intval($user->ID);
            $account_status = (string)get_user_meta($uid, 'bsms_account_status', true);
            if ($account_status === 'suspended') self::fail(__('Account is suspended', 'bulk-sms-portal'));
            if (class_exists('BSMS_Entitlements') && !BSMS_Entitlements::is_enabled('api_access', $uid)) {
                self::fail(__('API access is not enabled for this account', 'bulk-sms-portal'));
            }
            return (object)array('user_id'=>$uid, 'api_username'=>$user->user_login, 'auth_mode'=>'account');
        }

        // Backward compatibility for integrations already using a generated
        // gateway credential from versions prior to 3.2.39.5.
        global $wpdb;
        $keys = BSMS_DB::table('api_keys');
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_api_keys WHERE api_username=%s AND status='active' LIMIT 1", $username));
        if ($row && !empty($row->api_password_hash) && wp_check_password($password, $row->api_password_hash)) {
            $uid = intval($row->user_id);
            if ((string)get_user_meta($uid, 'bsms_account_status', true) === 'suspended') self::fail(__('Account is suspended', 'bulk-sms-portal'));
            if (class_exists('BSMS_Entitlements') && !BSMS_Entitlements::is_enabled('api_access', $uid)) self::fail(__('API access is not enabled for this account', 'bulk-sms-portal'));
            return $row;
        }

        $record_failure();
        if (class_exists('BSMS_Security')) BSMS_Security::log('public_api_auth_failed','Invalid public API credentials', array('username'=>$username));
        if (class_exists('BSMS_Routing')) BSMS_Routing::log_usage(0, $username, 'auth', '', 'failed', 0, 0, array('reason'=>'invalid_credentials'));
        self::fail(__('Invalid API Credentials', 'bulk-sms-portal'));
    }

    public static function route_from_type($type){
        $type = strtolower(trim((string)$type));
        if ($type === '' || $type === 'auto') {
            $default = strtolower((string)get_option('bsms_default_api_route','normal'));
            return in_array($default, array('normal','dnd','premium'), true) ? BSMS_Providers::normalise_route($default) : 'normal';
        }
        if (in_array($type, array('premium','dnd','dndbypass','bypass'), true)) return 'dnd';
        return 'normal';
    }

    private static function first_param($keys, $fallback=''){
        foreach ((array)$keys as $key) {
            $value = self::param($key, '');
            if ($value !== '') return $value;
        }
        return $fallback;
    }

    public static function send(){
        $auth = self::authenticate();
        $uid = intval($auth->user_id);

        $message = self::message_param('message');
        $source = self::first_param(array('sender','source','sender_id'));
        $destination = self::first_param(array('recipients','destination','to','numbers'));
        $type = self::first_param(array('route','type'), 'auto');
        $dlr = self::param('dlr', '1');

        if (!$message) self::fail(__('Missing message', 'bulk-sms-portal'));
        if (!$destination) self::fail(__('Missing destination', 'bulk-sms-portal'));
        if (!$source) $source = BSMS_Campaigns::default_sender($uid);

        $route = self::route_from_type($type);

        // Run the public request as the authenticated account owner before any
        // capability, entitlement, wallet, pricing or ownership checks occur.
        wp_set_current_user($uid);


        // Sender validation/fallback is deliberately delegated to
        // BSMS_Campaigns::create(), which already validates against the account's
        // approved Sender IDs and applies the normal default fallback.

        // Let the shared utility handle Nigerian/local formatting, commas,
        // semicolons and line-separated recipient lists exactly as the portal
        // does. BSMS_Campaigns::create() performs the final normalisation and
        // de-duplication as the single source of truth.
        $recipients = BSMS_Util::parse_numbers($destination);
        if (!$recipients) self::fail(__('No valid recipient', 'bulk-sms-portal'));

        $gate = BSMS_Campaigns::api_gate($uid, count(array_unique($recipients)), false);
        if (is_wp_error($gate)) self::fail($gate->get_error_message(), array('internal_code'=>$gate->get_error_code()));

        // Do not call the REST callback from template_redirect. The REST method
        // is designed for a REST-server lifecycle and previously allowed an
        // exception in that bridge to collapse into a generic "Server error".
        // Call the shared campaign domain service directly instead; this is the
        // same create/pricing/wallet/job pipeline used by campaign_send().
        $result = BSMS_Campaigns::create(
            $uid,
            __('API Campaign', 'bulk-sms-portal'),
            $message,
            $recipients,
            $source,
            $route,
            null,
            true
        );

        if (is_wp_error($result)) {
            $code = sanitize_key($result->get_error_code());
            if (class_exists('BSMS_Routing')) {
                BSMS_Routing::log_usage($uid, $auth->api_username ?? '', 'send', $route, 'failed', 0, 0, array('code'=>$code));
            }
            self::fail($result->get_error_message(), $code ? array('internal_code'=>$code) : array());
        }

        $campaign_id = intval($result['campaign_id'] ?? 0);
        if ($campaign_id < 1) self::fail(__('Campaign could not be created', 'bulk-sms-portal'));

        // Match the portal's asynchronous delivery behaviour: record first,
        // return quickly, and let the existing queue worker contact providers.
        if (class_exists('BSMS_Cron')) {
            wp_schedule_single_event(time() + 1, BSMS_Cron::HOOK);
            if (function_exists('spawn_cron')) spawn_cron(time());
        }

        $balance = BSMS_Wallet::get_balance_kobo($uid);

        if (class_exists('BSMS_Security')) {
            BSMS_Security::log(
                'public_api_send',
                'Public API SMS submitted',
                array('campaign_id'=>$campaign_id,'route'=>$route,'dlr'=>$dlr),
                'campaign',
                $campaign_id,
                $uid
            );
        }

        if (class_exists('BSMS_Routing')) {
            BSMS_Routing::log_usage(
                $uid,
                $auth->api_username ?? '',
                'send',
                $route,
                'success',
                intval($result['recipients'] ?? 0),
                intval($result['cost_kobo'] ?? 0),
                array('campaign_id'=>$campaign_id)
            );
        }

        self::ok(array(
            'message'=>__('Message accepted for processing.', 'bulk-sms-portal'),
            'legacy_message'=>__('Message Sent', 'bulk-sms-portal'),
            'code'=>'NS1000',
            'messageid'=>'MSG'.$campaign_id,
            'campaign_id'=>$campaign_id,
            'accepted'=>intval($result['recipients'] ?? 0),
            'sender'=>$result['sender_id'] ?? $source,
            'route'=>$route,
            'cost'=>number_format(intval($result['cost_kobo'] ?? 0)/100, 2, '.', ''),
            'balance'=>number_format($balance/100, 2, '.', ''),
            'processing'=>true,
            'processing_status'=>'QUEUED',
            'segments'=>max(1, BSMS_Util::sms_pages($message))
        ));
    }

    public static function balance(){
        $auth = self::authenticate();
        $balance = BSMS_Wallet::get_balance_kobo(intval($auth->user_id));
        if (class_exists('BSMS_Routing')) BSMS_Routing::log_usage(intval($auth->user_id), $auth->api_username ?? '', 'balance', '', 'success');
        self::ok(array(
            'balance'=>number_format($balance/100, 2, '.', ''),
            'currency'=>'NGN',
            'code'=>'NS1100'
        ));
    }

    public static function status(){
        $auth = self::authenticate();
        $uid = intval($auth->user_id);
        $messageid = self::first_param(array('messageid','message_id','id'));
        $campaign_id = intval(preg_replace('/\D+/', '', $messageid));

        if (!$campaign_id) self::fail(__('Missing messageid', 'bulk-sms-portal'));

        global $wpdb;
        $c = BSMS_DB::table('campaigns');
        $j = BSMS_DB::table('jobs');

        $campaign = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_campaigns WHERE id=%d AND user_id=%d", $campaign_id, $uid));
        if (!$campaign) self::fail(__('Message ID not found', 'bulk-sms-portal'));

        $rows = $wpdb->get_results($wpdb->prepare("SELECT status_bucket, provider_status, err_code, api_id, sent_at FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d AND user_id=%d", $campaign_id, $uid), ARRAY_A);
        $total = count($rows); $accepted = 0; $delivered = 0; $failed = 0; $pending = 0;
        foreach ($rows as $row) {
            $canonical = class_exists('BSMS_Providers') ? BSMS_Providers::canonical_job_status($row) : strtolower((string)$row['status_bucket']);
            if ($canonical === 'accepted') $accepted++;
            elseif ($canonical === 'delivered') $delivered++;
            elseif ($canonical === 'failed') $failed++;
            else $pending++;
        }

        // Public consumers receive the same unambiguous result vocabulary as the portal.
        // Provider acceptance and final delivery both mean the API submission succeeded.
        $status = $failed > 0 ? 'failed' : ($pending > 0 || $total === 0 ? null : 'successful');

        if (class_exists('BSMS_Routing')) BSMS_Routing::log_usage($uid, $auth->api_username ?? '', 'status', '', 'success', 0, 0, array('campaign_id'=>$campaign_id));

        $public_code = $status === 'successful' ? 'NS1001' : ($status === 'failed' ? 'NS3001' : 'NS1002');
        self::ok(array(
            'code'=>$public_code,
            'messageid'=>'MSG'.$campaign_id,
            'delivery_status'=>$status,
            'total'=>$total,
            'successful'=>$accepted + $delivered,
            'failed'=>$failed,
            'processing'=>$pending
        ));
    }

}
