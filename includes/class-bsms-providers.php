<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Providers {
    public static function normalise_route($route){
        $route = strtolower(trim((string)$route));
        if (in_array($route, array('premium','dnd','dnd_bypass'), true)) return 'dnd';
        if (in_array($route, array('intl','international'), true)) return 'international';
        return 'normal';
    }

    public static function route_candidates($route){
        $route = self::normalise_route($route);
        $candidates = array($route);
        if ($route === 'dnd') $candidates[] = 'premium'; // legacy compatibility only
        if ($route === 'normal') $candidates[] = 'standard';
        $candidates[] = 'normal';
        return array_values(array_unique(array_filter($candidates)));
    }

    public static function route_for_recipient($route, $recipient, $default_cc='234'){
        $route = self::normalise_route($route);
        $digits = preg_replace('/\D+/', '', (string)$recipient);
        $default_cc = preg_replace('/\D+/', '', (string)$default_cc);
        if ($digits !== '' && $default_cc !== '' && strpos($digits, $default_cc) !== 0) {
            return 'international';
        }
        return $route === 'international' ? 'international' : $route;
    }

    public static function route_label($route){
        $route = self::normalise_route($route);
        if ($route === 'dnd') return __('DND Delivery', 'bulk-sms-portal');
        if ($route === 'international') return __('International', 'bulk-sms-portal');
        return __('Normal SMS', 'bulk-sms-portal');
    }

    /** The SMS service used for a kind of message: the one service, unless an add-on chooses another. */
    public static function service_for_route($route){
        $id = intval(get_option('bsms_default_api_id', 0));
        return intval(apply_filters('bsms_service_for_route', $id, self::normalise_route($route)));
    }

    public static function route_option_key($route){
        $route = self::normalise_route($route);
        return 'bsms_route_api_' . $route;
    }

    public static function clear_balance_cache($api_id=0, $route=''){
        $api_id = intval($api_id);
        if ($api_id > 0) delete_transient('bsms_api_balance_id_' . $api_id);
        foreach (array('normal','dnd','international') as $r) delete_transient('bsms_api_balance_' . md5($r));
        if ($route !== '') delete_transient('bsms_api_balance_' . md5(self::normalise_route($route)));
    }

    /** v3.7.1: an SMS service is ready to send these numbers (one sample per route). */
    public static function ready_for($numbers, $route, $user_id=0){
        $seen = array();
        foreach ((array)$numbers as $n) {
            $cc = BSMS_Util::default_country($user_id);
            $r = self::route_for_recipient($route, $n, $cc);
            if (isset($seen[$r])) continue;
            $seen[$r] = true;
            $res = self::resolve_api(array('user_id'=>intval($user_id), 'selected_route'=>$route, 'recipient'=>$n, 'default_cc'=>$cc));
            if (empty($res['api'])) return false;
        }
        return true;
    }

    public static function resolve_api($args=array()){
        $args = wp_parse_args((array)$args, array(
            'user_id'=>0,
            'selected_route'=>'normal',
            'recipient'=>'',
            'default_cc'=>'234',
            'force_api_id'=>0,
        ));
        $selected_route = self::normalise_route($args['selected_route']);
        $effective_route = self::route_for_recipient($selected_route, $args['recipient'], $args['default_cc']);
        $debug = array(
            'selected_route'=>$selected_route,
            'effective_route'=>$effective_route,
            'resolved_by'=>'none',
            'api_id'=>0,
            'api_name'=>'',
        );

        $force_api_id = intval($args['force_api_id']);
        if ($force_api_id > 0) {
            $api = self::api_by_id($force_api_id);
            if ($api) {
                $debug['resolved_by'] = 'forced_api_test';
                $debug['api_id'] = intval($api->id);
                $debug['api_name'] = (string)$api->name;
                return array('api'=>$api, 'route'=>$effective_route, 'debug'=>$debug);
            }
        }

        // Add-ons can choose a different SMS service (for a customer or a kind of message).
        $chosen = apply_filters('bsms_resolve_api', null, $args, $effective_route);
        if (is_array($chosen) && !empty($chosen['api'])) {
            $debug['resolved_by'] = (string)($chosen['resolved_by'] ?? 'add_on');
            $debug['api_id'] = intval($chosen['api']->id);
            $debug['api_name'] = (string)$chosen['api']->name;
            return array('api'=>$chosen['api'], 'route'=>$effective_route, 'debug'=>$debug);
        }

        // One SMS service carries every message: standard, Do Not Disturb and international.
        $default_id = intval(get_option('bsms_default_api_id', 0));
        if ($default_id > 0) {
            $api = self::api_by_id($default_id);
            if ($api) {
                $debug['resolved_by'] = 'global_default';
                $debug['api_id'] = intval($api->id);
                $debug['api_name'] = (string)$api->name;
                return array('api'=>$api, 'route'=>$effective_route, 'debug'=>$debug);
            }
        }

        return array('api'=>null, 'route'=>$effective_route, 'debug'=>$debug);
    }

    public static function harmonise_api_url($url, $preset='', $kind='send'){
        $url = trim((string)$url);
        if ($url === '') return $url;

        // Generic HTTP safety: a blank type= parameter is invalid for many SMS gateways.
        // When present but empty/auto, use plain text type 0 rather than leaving a broken URL.
        if ($kind === 'send') {
            $url = preg_replace('/([?&]type=)(?=&|$)/i', '$1' . '0', $url);
            $url = preg_replace('/([?&]type=)auto(?=&|$)/i', '$1' . '0', $url);

            // Some Bulk HTTP providers require a message-type parameter but admins may omit it
            // while configuring a generic GET API. Add a safe default only for URLs that clearly
            // follow the common bulk HTTP shape: destination + source + message + dlr.
            $lower = strtolower($url);
            $looks_bulk_http = (strpos($lower, 'destination=') !== false && strpos($lower, 'source=') !== false && strpos($lower, 'message=') !== false && strpos($lower, 'dlr=') !== false);
            if ($looks_bulk_http && !preg_match('/[?&]type=/i', $url)) {
                $sep = (strpos($url, '?') === false) ? '?' : '&';
                $url .= $sep . 'type=0';
            }
        }
        return $url;
    }

    private static function api_uses_numeric_recipient($api){
        $url = (string)($api->send_url ?? '');
        // Most SMS HTTP APIs expect MSISDN digits in one of these recipient parameters.
        return (bool)preg_match('/[?&](destination|recipient|msisdn|mobiles|mobile|to|phone)=/i', $url);
    }

    private static function provider_recipient($api, $to){
        $to = trim((string)$to);
        if (self::api_uses_numeric_recipient($api)) {
            $digits = BSMS_Util::clean_provider_phone($to, '234');
            return $digits ?: preg_replace('/\D+/', '', $to);
        }
        return $to;
    }

    private static function normalise_credential_value($value){
        $value = trim((string)$value);
        if ($value === '') return '';
        // Admins often paste either raw credentials (Sem@s@16) or URL-encoded values
        // copied from a working browser URL (Sem%40s%4016). Store/build requests from
        // the raw value and URL-encode exactly once when generating the provider URL.
        $decoded = $value;
        for ($i = 0; $i < 2; $i++) {
            if (!preg_match('/%[0-9A-Fa-f]{2}/', $decoded)) break;
            $next = rawurldecode($decoded);
            if ($next === $decoded) break;
            $decoded = $next;
        }
        return trim($decoded);
    }

    public static function normalise_api_credential($value){
        return self::normalise_credential_value($value);
    }

    private static function api_credential($api, $field){
        $field = $field === 'password' ? 'api_password' : 'api_username';
        if (isset($api->$field)) {
            return self::normalise_credential_value($api->$field);
        }
        return '';
    }

    private static function set_query_param_raw($url, $key, $value){
        $url = trim((string)$url);
        $key = (string)$key;
        if ($url === '' || $key === '' || $value === '') return $url;
        $encoded_key = rawurlencode($key);
        $encoded_val = rawurlencode((string)$value);
        if (preg_match('/([?&])' . preg_quote($key, '/') . '=[^&#]*/i', $url)) {
            return preg_replace('/([?&])' . preg_quote($key, '/') . '=[^&#]*/i', '$1' . $encoded_key . '=' . $encoded_val, $url);
        }
        $hash = '';
        $hash_pos = strpos($url, '#');
        if ($hash_pos !== false) {
            $hash = substr($url, $hash_pos);
            $url = substr($url, 0, $hash_pos);
        }
        $sep = (strpos($url, '?') === false) ? '?' : '&';
        return $url . $sep . $encoded_key . '=' . $encoded_val . $hash;
    }

    private static function url_has_query_key($url, $key){
        return (bool)preg_match('/[?&]' . preg_quote((string)$key, '/') . '=/i', (string)$url);
    }

    private static function query_value($url, $keys){
        $url = (string)$url;
        $parts = wp_parse_url($url);
        if (empty($parts['query'])) return '';
        parse_str($parts['query'], $q);
        foreach ((array)$keys as $key) {
            if (isset($q[$key]) && (string)$q[$key] !== '') {
                return trim((string)$q[$key]);
            }
        }
        return '';
    }

    public static function infer_credentials_from_urls($send_url, $balance_url){
        $u = self::query_value($send_url, array('username','user'));
        $p = self::query_value($send_url, array('password','pass'));
        if ($u === '') $u = self::query_value($balance_url, array('username','user'));
        if ($p === '') $p = self::query_value($balance_url, array('password','pass'));
        return array('username'=>$u, 'password'=>$p);
    }

    private static function set_query_param_placeholder($url, $key, $placeholder){
        $url = trim((string)$url);
        if ($url === '' || $key === '') return $url;
        $hash = '';
        $hash_pos = strpos($url, '#');
        if ($hash_pos !== false) {
            $hash = substr($url, $hash_pos);
            $url = substr($url, 0, $hash_pos);
        }
        if (preg_match('/([?&])' . preg_quote($key, '/') . '=[^&#]*/i', $url)) {
            return preg_replace('/([?&])' . preg_quote($key, '/') . '=[^&#]*/i', '$1' . $key . '=' . $placeholder, $url) . $hash;
        }
        $sep = (strpos($url, '?') === false) ? '?' : '&';
        return $url . $sep . $key . '=' . $placeholder . $hash;
    }

    public static function normalise_credential_placeholders($url){
        $url = trim((string)$url);
        if ($url === '') return $url;
        if (self::url_has_query_key($url, 'username')) $url = self::set_query_param_placeholder($url, 'username', '@@username@@');
        elseif (self::url_has_query_key($url, 'user')) $url = self::set_query_param_placeholder($url, 'user', '@@username@@');
        if (self::url_has_query_key($url, 'password')) $url = self::set_query_param_placeholder($url, 'password', '@@password@@');
        elseif (self::url_has_query_key($url, 'pass')) $url = self::set_query_param_placeholder($url, 'pass', '@@password@@');
        return $url;
    }

    private static function credential_debug($api){
        $u = self::api_credential($api, 'username');
        $p = self::api_credential($api, 'password');
        $encoded_password = $p !== '' ? rawurlencode($p) : '';
        return array(
            'username_present' => $u !== '',
            'password_present' => $p !== '',
            'username_length' => strlen($u),
            'password_length' => strlen($p),
            'credential_source' => ($u !== '' || $p !== '') ? 'api_fields' : 'url_only',
            // v1.8.5: credentials are always passed through RFC3986 URL encoding at final transport build.
            // For URL-safe passwords (for example underscores), the visible value may not change, but encoding
            // was still applied. Keep the old change flag separately so diagnostics do not mislead admins.
            'password_was_url_encoded_on_build' => $p !== '',
            'password_encoding_changed_value' => $p !== '' && $encoded_password !== $p,
            'password_double_encoding_risk' => $p !== '' && preg_match('/%25[0-9A-Fa-f]{2}/', $encoded_password) ? true : false,
        );
    }

    private static function url_has_unresolved_placeholders($url){
        return (bool)preg_match('/@@(?:username|password|api_username|api_password)@@/i', (string)$url);
    }

    private static function url_has_empty_credentials($url){
        $url = (string)$url;
        $parts = wp_parse_url($url);
        if (empty($parts['query'])) return false;
        parse_str($parts['query'], $q);
        foreach (array('username','user','password','pass') as $key) {
            if (array_key_exists($key, $q) && trim((string)$q[$key]) === '') return true;
        }
        return false;
    }

    private static function url_requires_provider_credentials($url){
        $url = (string)$url;
        $parts = wp_parse_url($url);
        if (empty($parts['query'])) return false;
        parse_str($parts['query'], $q);
        foreach (array('username','user','password','pass') as $key) {
            if (array_key_exists($key, $q)) return true;
        }
        return false;
    }

    private static function missing_provider_credentials($api, $url=''){
        $needs = self::url_requires_provider_credentials($url ?: (string)($api->send_url ?? ''));
        if (!$needs) return false;
        return self::api_credential($api, 'username') === '' || self::api_credential($api, 'password') === '';
    }

    private static function credential_error($api, $url, $route='normal'){
        $err = new WP_Error('api_credentials_not_saved', __('SMS API username/password are not saved for this provider. Edit the API, enter API Username and API Password, save, then test again.', 'bulk-sms-portal'));
        $err->add_data(array_merge(array(
            'request_url'=>self::redact_url($url),
            'api_id'=>intval($api->id ?? 0),
            'route'=>$route,
            'credential_action'=>'Set API Username and API Password in API Manager. Do not leave them blank and do not rely on username=&password= inside the URL.'
        ), self::credential_debug($api)));
        return $err;
    }

    private static function apply_api_credentials_to_url($url, $api){
        $username = self::api_credential($api, 'username');
        $password = self::api_credential($api, 'password');
        if ($username !== '') {
            if (self::url_has_query_key($url, 'username')) $url = self::set_query_param_raw($url, 'username', $username);
            elseif (self::url_has_query_key($url, 'user')) $url = self::set_query_param_raw($url, 'user', $username);
        }
        if ($password !== '') {
            if (self::url_has_query_key($url, 'password')) $url = self::set_query_param_raw($url, 'password', $password);
            elseif (self::url_has_query_key($url, 'pass')) $url = self::set_query_param_raw($url, 'pass', $password);
        }
        return $url;
    }

    private static function encode_url_query_values($url){
        $url = trim((string)$url);
        if ($url === '' || strpos($url, '?') === false) return $url;
        $parts = wp_parse_url($url);
        if (empty($parts['query'])) return $url;
        $pairs = explode('&', $parts['query']);
        $encoded = array();
        foreach ($pairs as $pair) {
            if ($pair === '') continue;
            $kv = explode('=', $pair, 2);
            $key = isset($kv[0]) ? rawurldecode($kv[0]) : '';
            $val = isset($kv[1]) ? rawurldecode($kv[1]) : '';
            if ($key === '') continue;
            // Always rebuild every query key/value using RFC3986 encoding immediately before transport.
            // This normalises raw credentials, already-encoded credentials, messages, sender IDs and recipients
            // into one canonical URL form and prevents mixed raw/encoded provider requests.
            $encoded[] = rawurlencode($key) . '=' . rawurlencode($val);
        }
        $scheme = isset($parts['scheme']) ? $parts['scheme'] . '://' : '';
        $user = isset($parts['user']) ? rawurlencode($parts['user']) : '';
        $pass = isset($parts['pass']) ? ':' . rawurlencode($parts['pass']) : '';
        $auth = $user !== '' ? $user . $pass . '@' : '';
        $host = isset($parts['host']) ? $parts['host'] : '';
        $port = isset($parts['port']) ? ':' . intval($parts['port']) : '';
        $path = isset($parts['path']) ? $parts['path'] : '';
        $fragment = isset($parts['fragment']) ? '#' . rawurlencode($parts['fragment']) : '';
        return $scheme . $auth . $host . $port . $path . '?' . implode('&', $encoded) . $fragment;
    }


    public static function api_by_id($api_id){
        global $wpdb;
        $api_id = intval($api_id);
        if ($api_id <= 0) return null;
        $t = BSMS_DB::table('apis');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_apis WHERE id=%d AND is_active=1", $api_id));
    }


    public static function all_apis(){
        global $wpdb;
        $t = BSMS_DB::table('apis');
        return $wpdb->get_results("SELECT * FROM {$wpdb->prefix}bsms_apis ORDER BY id DESC");
    }

    public static function send_sms($to, $message, $sender, $route='normal', $meta=array()){
        $default_cc = isset($meta['default_cc']) ? $meta['default_cc'] : '234';
        $job_id = isset($meta['job_id']) ? intval($meta['job_id']) : 0;
        $campaign_id = isset($meta['campaign_id']) ? intval($meta['campaign_id']) : 0;
        $resolved = self::resolve_api(array(
            'user_id'=>isset($meta['user_id']) ? intval($meta['user_id']) : 0,
            'selected_route'=>$route,
            'recipient'=>$to,
            'default_cc'=>$default_cc,
            'force_api_id'=>isset($meta['force_api_id']) ? intval($meta['force_api_id']) : 0,
        ));
        $api = $resolved['api'];
        $route = $resolved['route'];
        $route_debug = $resolved['debug'];
        if (!$api) {
            $err = new WP_Error('no_api', sprintf(/* translators: %s: a value filled in when shown */ __('No SMS API configured for the selected route: %s', 'bulk-sms-portal'), self::route_label($route)));
            $err->add_data(array('route'=>$route, 'route_resolution'=>$route_debug, 'provider_reason'=>__('No API configured', 'bulk-sms-portal'), 'provider_code'=>'NO_API'));
            return $err;
        }

        $provider_to = self::provider_recipient($api, $to);

        $dlr_url = !empty($api->dlr_url) ? $api->dlr_url : (class_exists('BSMS_Security') ? BSMS_Security::dlr_callback_url(intval($api->id)) : rest_url('bsms/v1/dlr'));
        $callback_url = $dlr_url;

        $payload = array(
            'to' => $provider_to,
            'recipient' => $provider_to,
            'phone' => $provider_to,
            'msisdn' => $provider_to,
            'message' => $message,
            'text' => $message,
            'sender' => $sender,
            'sender_id' => $sender,
            'from' => $sender,
            'route' => $route,
            'job_id' => $job_id,
            'campaign_id' => $campaign_id,
            'dlr_url' => $dlr_url,
            'callback_url' => $callback_url,
            'username' => self::api_credential($api, 'username'),
            'password' => self::api_credential($api, 'password'),
            'api_username' => self::api_credential($api, 'username'),
            'api_password' => self::api_credential($api, 'password'),
        );

        $headers = self::fill_header_credentials(self::parse_headers($api->auth_headers), $api);

        $method = strtoupper((string)$api->method);
        if ($method !== 'GET') $method = 'POST';

        $format = isset($api->request_format) ? strtolower((string)$api->request_format) : 'json';
        if (!in_array($format, array('json','form','raw'), true)) $format = 'json';

        $url = self::harmonise_api_url($api->send_url, $api->provider_preset ?? '', 'send');
        $url = self::normalise_credential_placeholders($url);
        if (self::missing_provider_credentials($api, $url)) {
            return self::credential_error($api, $url, $route);
        }
        $url = self::replace_placeholders($url, $payload, 'url');
        $url = self::apply_api_credentials_to_url($url, $api);
        $url = self::encode_url_query_values($url);
        if (self::url_has_unresolved_placeholders(rawurldecode($url))) {
            $err = new WP_Error('api_credentials_missing', __('SMS API credentials are missing or were not saved. Re-enter API Username and API Password, then save the API again.', 'bulk-sms-portal'));
            $err->add_data(array_merge(array('request_url'=>self::redact_url($url), 'api_id'=>intval($api->id), 'route'=>$route), self::credential_debug($api)));
            return $err;
        }
        if (self::url_has_empty_credentials($url)) {
            $err = new WP_Error('api_credentials_empty', __('SMS API username/password are blank in the generated request. Re-enter API Username and API Password, then save the API again.', 'bulk-sms-portal'));
            $err->add_data(array_merge(array('request_url'=>self::redact_url($url), 'api_id'=>intval($api->id), 'route'=>$route), self::credential_debug($api)));
            return $err;
        }
        $extra_query = self::parse_extra_query($api->extra_query ?? '', $payload);
        if (!empty($extra_query)) $url = add_query_arg(array_map('rawurlencode', $extra_query), $url);

        $args = array('headers' => $headers, 'timeout' => 45);

        if ($method === 'GET') {
            // URL-template gateways such as HTTP URL template normally include all params in send_url.
            // Only append generic payload when the URL contains no recognised placeholders.
            if (!self::has_placeholders((string)$api->send_url) && empty($extra_query)) {
                $url = add_query_arg(array_map('rawurlencode', $payload), $url);
            }
            $res = wp_remote_get($url, $args);
        } else {
            if ($format === 'form') {
                $args['headers']['Content-Type'] = 'application/x-www-form-urlencoded';
                if (!empty($api->payload_template)) {
                    $form_body = self::fill_form_template($api->payload_template, $payload);
                    $args['body'] = $form_body ?: $payload;
                } else {
                    $args['body'] = $payload;
                }
            } elseif ($format === 'raw') {
                $args['headers']['Content-Type'] = isset($args['headers']['Content-Type']) ? $args['headers']['Content-Type'] : 'text/plain';
                $args['body'] = self::replace_placeholders((string)$api->payload_template, $payload, 'raw');
            } else {
                $args['headers']['Content-Type'] = 'application/json';
                if (!empty($api->payload_template)) {
                    $args['body'] = self::fill_json_template($api->payload_template, $payload);
                } else {
                    $args['body'] = wp_json_encode($payload);
                }
            }
            $res = wp_remote_post($url, $args);
        }

        self::clear_balance_cache(intval($api->id), $route);

        if (is_wp_error($res)) {
            if (class_exists('BSMS_Routing') && !empty($api->id)) BSMS_Routing::mark_failure($api->id, $route, $res->get_error_message());
            $help = self::transport_error_help($url, $res->get_error_message());
            // v3.7.2: when the SMS service could not be reached at all (address not
            // found, connection refused, secure connection not made), the message
            // was never handed over. That is a definite failure: the charge goes
            // back. A timeout is different: the service may have received it.
            $emsg = strtolower($res->get_error_message());
            $not_reached = (bool)preg_match('/curl error (6|7|35|60|77)\b|could not resolve|couldn.t resolve|failed to connect|connection refused|ssl connect error|ssl certificate problem/', $emsg);
            $reach = $not_reached ? array('confirmed_rejection'=>true, 'provider_code'=>'NOT_REACHED', 'provider_reason'=>__('The SMS service could not be reached, so the message was not sent.', 'bulk-sms-portal')) : array();
            $res->add_data(array_merge($reach, array('request_url'=>self::redact_url($url), 'api_id'=>intval($api->id), 'api_name'=>(string)($api->name ?? ''), 'route'=>$route, 'route_resolution'=>$route_debug, 'transport_help'=>$help), self::maybe_exact_url_debug($url, $meta)));
            return $res;
        }

        $body = (string)wp_remote_retrieve_body($res);
        $code = intval(wp_remote_retrieve_response_code($res));
        $decoded = json_decode($body, true);
        $parsed = self::parse_provider_response($api, $body, $to, $decoded);

        $http_ok = ($code >= 200 && $code < 300);
        $submission_state = !empty($parsed['success']) ? 'accepted' : (!empty($parsed['confirmed_rejection']) ? 'rejected' : 'unconfirmed');

        // v3.4.2: a gateway/server error (HTTP 5xx) does not prove the message was
        // refused: the provider may have queued it before the error. Treat it as
        // unconfirmed (charge kept, no resend, no automatic refund). A 4xx answer
        // (bad credentials, bad request) is a genuine refusal.
        $server_error = ($code >= 500 || $code === 0 || ($code >= 300 && $code < 400));
        if ($server_error && $submission_state !== 'rejected') {
            if (class_exists('BSMS_Routing') && !empty($api->id)) BSMS_Routing::mark_failure($api->id, $route, 'HTTP ' . $code);
            return array(
                'submission_state'=>'unconfirmed',
                'provider_message_id'=>$parsed['provider_message_id'] ?? '',
                'provider_message_id_type'=>!empty($parsed['provider_message_id']) ? 'provider' : 'none',
                'delivery_final'=>false,
                'provider_status'=>'UNCONFIRMED',
                'provider_code'=>'HTTP_' . $code,
                'provider_reason'=>sprintf(/* translators: %s: a value filled in when shown */ __('The SMS service returned a server error (HTTP %s). It may still have accepted the message.', 'bulk-sms-portal'), $code),
                'provider_operator'=>$parsed['operator'] ?? '',
                'provider_raw_status'=>$parsed['raw_status'] ?? '',
                'http_code'=>$code,
                'raw'=>$body,
                'request_url'=>self::redact_url($url),
                'api_id'=>intval($api->id),
                'api_name'=>(string)($api->name ?? ''),
                'route'=>$route,
                'route_resolution'=>$route_debug,
            );
        }

        // Transport/HTTP failure and an explicit provider rejection are genuine
        // failures. A 2xx response whose semantics are unknown is NOT a failure:
        // return it as unconfirmed so the queue can await DLR/admin verification
        // without refunding, resending, or degrading route health.
        if (!$http_ok || $submission_state === 'rejected') {
            $reason = $parsed['reason'] ?: ('HTTP ' . $code . ': ' . self::shorten($body, 500));
            if (class_exists('BSMS_Routing') && !empty($api->id)) BSMS_Routing::mark_failure($api->id, $route, $reason);
            $err = new WP_Error(!$http_ok ? 'api_http_failed' : 'api_rejected', sprintf(/* translators: %s: a value filled in when shown */ __('SMS API failed. %s', 'bulk-sms-portal'), $reason));
            $err->add_data(array_merge(array(
                'submission_state'=>$submission_state,
                'provider_code'=>$parsed['code'],
                'provider_reason'=>$parsed['reason'],
                'provider_message_id'=>$parsed['provider_message_id'] ?? '',
                'provider_status'=>$parsed['provider_status'],
                'provider_operator'=>$parsed['operator'] ?? '',
                'provider_raw_status'=>$parsed['raw_status'] ?? '',
                'confirmed_rejection'=>($submission_state === 'rejected' || !$http_ok),
                'raw'=>$body,
                'http_code'=>$code,
                'request_url'=>self::redact_url($url),
                'api_id'=>intval($api->id),
                'api_name'=>(string)($api->name ?? ''),
                'route'=>$route,
                'route_resolution'=>$route_debug,
            ), self::credential_debug($api), self::maybe_exact_url_debug($url, $meta)));
            return $err;
        }

        if ($submission_state === 'unconfirmed') {
            return array(
                'submission_state'=>'unconfirmed',
                'provider_message_id'=>$parsed['provider_message_id'] ?? '',
                'provider_message_id_type'=>!empty($parsed['provider_message_id']) ? 'provider' : 'none',
                'delivery_final'=>false,
                'provider_status'=>'UNCONFIRMED',
                'provider_code'=>$parsed['code'] ?? '',
                'provider_reason'=>$parsed['reason'] ?: __('The SMS service response did not confirm acceptance or rejection.', 'bulk-sms-portal'),
                'provider_operator'=>$parsed['operator'] ?? '',
                'provider_raw_status'=>$parsed['raw_status'] ?? '',
                'http_code'=>$code,
                'raw'=>$body,
                'request_url'=>self::redact_url($url),
                'api_id'=>intval($api->id),
                'api_name'=>(string)($api->name ?? ''),
                'route'=>$route,
                'route_resolution'=>$route_debug,
            );
        }

        if (class_exists('BSMS_Routing') && !empty($api->id)) BSMS_Routing::mark_success($api->id, $route);

        $provider_message_id = $parsed['provider_message_id'];
        $provider_message_id_type = 'provider';
        if (!$provider_message_id) {
            // v1.8.6: some providers accept/bill SMS but return no per-message reference.
            // Keep an internal reference for reporting while labelling it as local, not provider-confirmed.
            $provider_message_id = 'LOCAL-' . $job_id . '-' . wp_generate_password(10, false, false);
            $provider_message_id_type = 'internal';
        }

        $success_out = array(
            'submission_state' => 'accepted',
            'provider_message_id' => $provider_message_id,
            'provider_message_id_type' => $provider_message_id_type,
            'delivery_final' => false,
            'provider_status' => $parsed['provider_status'] ?: 'SUBMITTED',
            'provider_code' => $parsed['code'] ?: 'OK',
            'provider_reason' => $parsed['reason'] ?: __('Message accepted by provider', 'bulk-sms-portal'),
            'provider_operator' => $parsed['operator'] ?? '',
            'provider_raw_status' => $parsed['raw_status'] ?? '',
            'http_code' => $code,
            'raw' => $body,
            'request_url' => self::redact_url($url),
            'api_id' => intval($api->id),
            'api_name' => (string)($api->name ?? ''),
            'route' => $route,
            'route_resolution' => $route_debug,
        );
        if (!empty($meta['test'])) $success_out = array_merge($success_out, self::maybe_exact_url_debug($url, $meta));
        return $success_out;
    }

    public static function api_balance_by_id($api_id){
        global $wpdb;
        $api_id = intval($api_id);
        if ($api_id <= 0) return '';
        $cache_key = 'bsms_api_balance_id_' . $api_id;
        $cached = get_transient($cache_key);
        if ($cached !== false) return $cached;
        $t = BSMS_DB::table('apis');
        $api = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_apis WHERE id=%d", $api_id));
        if (!$api || empty($api->balance_url)) return '';
        $headers = self::fill_header_credentials(self::parse_headers($api->auth_headers), $api);
        $payload = array(
            'username' => self::api_credential($api, 'username'),
            'password' => self::api_credential($api, 'password'),
            'api_username' => self::api_credential($api, 'username'),
            'api_password' => self::api_credential($api, 'password'),
        );
        $url = self::harmonise_api_url($api->balance_url, $api->provider_preset ?? '', 'balance');
        $url = self::normalise_credential_placeholders($url);
        if (self::missing_provider_credentials($api, $url)) { set_transient($cache_key, '', 60); return ''; }
        $url = self::replace_placeholders($url, $payload, 'url');
        $url = self::apply_api_credentials_to_url($url, $api);
        $url = self::encode_url_query_values($url);
        $res = wp_remote_get($url, array('headers'=>$headers, 'timeout'=>10, 'redirection'=>2));
        if (is_wp_error($res)) { set_transient($cache_key, '', 60); return ''; }
        $body = trim((string)wp_remote_retrieve_body($res));
        $out = '';
        if (!empty($api->balance_pattern)) {
            $decoded = json_decode($body, true);
            $path = self::json_path($decoded, $api->balance_pattern);
            if ($path !== null && $path !== '') $out = $path;
            else {
                $regex = self::normalise_regex($api->balance_pattern);
                if ($regex && @preg_match($regex, $body, $m) && isset($m[1])) $out = $m[1];
            }
        }
        if ($out === '' && preg_match('/(-?\d+(?:\.\d+)?)/', $body, $m)) $out = $m[1];
        if ($out === '') $out = self::shorten($body, 200);
        set_transient($cache_key, $out, 300);
        return $out;
    }

    public static function api_balance_debug_by_id($api_id){
        global $wpdb;
        $api_id = intval($api_id);
        if ($api_id <= 0) return array('ok'=>false,'error'=>__('Invalid API ID.', 'bulk-sms-portal'));
        $t = BSMS_DB::table('apis');
        $api = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_apis WHERE id=%d", $api_id));
        if (!$api) return array('ok'=>false,'error'=>__('API not found.', 'bulk-sms-portal'));
        if (empty($api->balance_url)) return array('ok'=>false,'error'=>__('No balance URL configured for this API.', 'bulk-sms-portal'));
        $headers = self::fill_header_credentials(self::parse_headers($api->auth_headers), $api);
        $payload = array(
            'username' => self::api_credential($api, 'username'),
            'password' => self::api_credential($api, 'password'),
            'api_username' => self::api_credential($api, 'username'),
            'api_password' => self::api_credential($api, 'password'),
        );
        $url = self::harmonise_api_url($api->balance_url, $api->provider_preset ?? '', 'balance');
        $url = self::normalise_credential_placeholders($url);
        if (self::missing_provider_credentials($api, $url)) {
            return array_merge(array('ok'=>false,'error'=>'API username/password are not saved for this provider. Edit the API, enter API Username and API Password, save, then test again.','request_url'=>self::redact_url($url)), self::credential_debug($api));
        }
        $url = self::replace_placeholders($url, $payload, 'url');
        $url = self::apply_api_credentials_to_url($url, $api);
        $url = self::encode_url_query_values($url);
        if (self::url_has_unresolved_placeholders(rawurldecode($url))) {
            return array_merge(array('ok'=>false,'error'=>'API credentials are missing or were not saved. Re-enter API Username and API Password, then save the API again.','request_url'=>self::redact_url($url)), self::credential_debug($api));
        }
        if (self::url_has_empty_credentials($url)) {
            return array_merge(array('ok'=>false,'error'=>'API username/password are blank in the generated balance request. Re-enter API Username and API Password, then save the API again.','request_url'=>self::redact_url($url)), self::credential_debug($api));
        }
        $res = wp_remote_get($url, array('headers'=>$headers, 'timeout'=>20, 'redirection'=>2));
        if (is_wp_error($res)) {
            return array('ok'=>false,'error'=>$res->get_error_message(),'request_url'=>self::redact_url($url),'transport_help'=>self::transport_error_help($url, $res->get_error_message()));
        }
        $body = trim((string)wp_remote_retrieve_body($res));
        $code = intval(wp_remote_retrieve_response_code($res));
        $parsed = '';
        if (!empty($api->balance_pattern)) {
            $decoded = json_decode($body, true);
            $path = self::json_path($decoded, $api->balance_pattern);
            if ($path !== null && $path !== '') $parsed = $path;
            else {
                $regex = self::normalise_regex($api->balance_pattern);
                if ($regex && @preg_match($regex, $body, $m) && isset($m[1])) $parsed = $m[1];
            }
        }
        if ($parsed === '' && preg_match('/(-?\d+(?:\.\d+)?)/', $body, $m)) $parsed = $m[1];
        delete_transient('bsms_api_balance_id_' . $api_id);
        return array_merge(array('ok'=>true,'api_id'=>$api_id,'http_code'=>$code,'balance'=>$parsed,'raw_response'=>self::shorten($body,1000),'request_url'=>self::redact_url($url)), self::credential_debug($api));
    }

    public static function api_balance($route='normal'){
        $route = self::normalise_route($route);
        $cache_key = 'bsms_api_balance_' . md5($route);
        $cached = get_transient($cache_key);
        if ($cached !== false) return $cached;

        $resolved = self::resolve_api(array('selected_route'=>$route));
        $api = $resolved['api'];
        if (!$api || empty($api->balance_url)) return '';

        $headers = self::fill_header_credentials(self::parse_headers($api->auth_headers), $api);
        $payload = array(
            'username' => self::api_credential($api, 'username'),
            'password' => self::api_credential($api, 'password'),
            'api_username' => self::api_credential($api, 'username'),
            'api_password' => self::api_credential($api, 'password'),
        );
        $url = self::harmonise_api_url($api->balance_url, $api->provider_preset ?? '', 'balance');
        $url = self::normalise_credential_placeholders($url);
        if (self::missing_provider_credentials($api, $url)) { set_transient($cache_key, '', 60); return ''; }
        $url = self::replace_placeholders($url, $payload, 'url');
        $url = self::apply_api_credentials_to_url($url, $api);
        $url = self::encode_url_query_values($url);
        $res = wp_remote_get($url, array('headers'=>$headers, 'timeout'=>5, 'redirection'=>2));
        if (is_wp_error($res)) {
            set_transient($cache_key, '', 60);
            return '';
        }

        $body = (string)wp_remote_retrieve_body($res);
        if (!empty($api->balance_pattern)) {
            if (strpos($api->balance_pattern, '{BODY}') !== false) {
                $out = str_replace('{BODY}', $body, $api->balance_pattern);
                set_transient($cache_key, $out, 300);
                return $out;
            }
            $decoded = json_decode($body, true);
            $path = self::json_path($decoded, $api->balance_pattern);
            if ($path !== null && $path !== '') {
                set_transient($cache_key, $path, 300);
                return $path;
            }
            if (@preg_match('/' . $api->balance_pattern . '/', $body, $m) && isset($m[1])) {
                set_transient($cache_key, $m[1], 300);
                return $m[1];
            }
        }
        $out = self::shorten($body, 200);
        set_transient($cache_key, $out, 300);
        return $out;
    }

    /**
     * Fill {key}, {{key}}, {key_url}, {{key_url}} and @@key@@ placeholders.
     *
     * v3.4.2: values are escaped for where they are placed, so text a customer
     * types (the message) can never add or change provider fields:
     *   'url'    every value is URL-encoded (a message containing "&sender=X"
     *            stays inside the message parameter);
     *   'raw'    values are inserted as-is (plain-text bodies), or XML-escaped
     *            when the template is XML;
     *   'legacy' the pre-3.4.2 behaviour, kept only for unknown callers.
     * JSON and form bodies use fill_json_template() / fill_form_template(),
     * which parse the template first and fill each field separately.
     */
    public static function replace_placeholders($text, $payload, $context='legacy'){
        $text = (string)$text;
        $xml = $context === 'raw' && strpos(ltrim($text), '<') === 0;
        foreach ($payload as $k=>$v) {
            $raw = (string)$v;
            $enc = rawurlencode($raw);
            if ($context === 'url') $plain = $enc;
            elseif ($xml) $plain = htmlspecialchars($raw, ENT_QUOTES | ENT_XML1, 'UTF-8');
            else $plain = $raw;
            $text = str_replace(array('{' . $k . '_url}', '{{' . $k . '_url}}'), $enc, $text);
            $text = str_replace(array('{{' . $k . '}}', '{' . $k . '}'), $plain, $text);
            // @@key@@ is a URL-template placeholder: encoded in URLs and legacy mode.
            $text = str_replace('@@' . $k . '@@', ($context === 'url' || $context === 'legacy') ? $enc : $plain, $text);
        }
        return $text;
    }

    /** Replace placeholders inside one already-separated field value (no escaping needed). */
    private static function fill_value($value, $payload){
        $value = (string)$value;
        foreach ($payload as $k=>$v) {
            $raw = (string)$v;
            $value = str_replace(array('{' . $k . '_url}', '{{' . $k . '_url}}'), rawurlencode($raw), $value);
            $value = str_replace(array('{{' . $k . '}}', '{' . $k . '}', '@@' . $k . '@@'), $raw, $value);
        }
        return $value;
    }

    private static function fill_deep($data, $payload){
        if (is_array($data)) {
            foreach ($data as $key=>$value) $data[$key] = self::fill_deep($value, $payload);
            return $data;
        }
        return is_string($data) ? self::fill_value($data, $payload) : $data;
    }

    /**
     * JSON request body. The template is decoded first and each string field is
     * filled on its own, then the whole body is re-encoded, so quotes or braces
     * in a message cannot create extra JSON fields (for example a second "from").
     */
    public static function fill_json_template($template, $payload){
        $decoded = json_decode((string)$template, true);
        if (is_array($decoded)) return wp_json_encode(self::fill_deep($decoded, $payload));
        // Template is not valid JSON on its own (for example an unquoted {to}):
        // insert JSON-escaped values so the result can still only hold data.
        $text = (string)$template;
        foreach ($payload as $k=>$v) {
            $escaped = substr(wp_json_encode((string)$v), 1, -1);
            $text = str_replace(array('{{' . $k . '}}', '{' . $k . '}', '@@' . $k . '@@'), $escaped, $text);
            $text = str_replace(array('{' . $k . '_url}', '{{' . $k . '_url}}'), rawurlencode((string)$v), $text);
        }
        $again = json_decode($text, true);
        return is_array($again) ? wp_json_encode($again) : $text;
    }

    /** Form request body: split the template into fields first, then fill each field. */
    public static function fill_form_template($template, $payload){
        parse_str((string)$template, $fields);
        if (!is_array($fields) || !$fields) return array();
        return self::fill_deep($fields, $payload);
    }

    /** Header values may use @@username@@ and @@password@@ (for example "Bearer @@password@@"). */
    public static function fill_header_credentials($headers, $api){
        foreach ($headers as $k => $v) {
            if (strpos($v, '@@') === false) continue;
            $headers[$k] = str_replace(array('@@username@@', '@@password@@'), array(self::api_credential($api, 'username'), self::api_credential($api, 'password')), $v);
        }
        return $headers;
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

    /** Extra query parameters: fields are separated first, then filled (raw values; callers encode). */
    private static function parse_extra_query($text, $payload){
        $raw = trim((string)$text);
        if ($raw === '') return array();
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $out = array();
            foreach ($decoded as $k=>$v) $out[$k] = self::fill_value(is_scalar($v) ? (string)$v : wp_json_encode($v), $payload);
            return $out;
        }
        parse_str($raw, $out);
        return is_array($out) ? self::fill_deep($out, $payload) : array();
    }

    private static function extract_message_id($api, $body, $decoded){
        if (!empty($api->message_id_json_path) && is_array($decoded)) {
            $v = self::json_path($decoded, $api->message_id_json_path);
            if ($v !== null && $v !== '') return (string)$v;
        }
        $message_id_pattern = self::api_field_or_preset($api, 'message_id_pattern', '');
        if ($message_id_pattern !== '') {
            $pattern = (string)$message_id_pattern;
            $regex = self::normalise_regex($pattern);
            if ($regex && @preg_match($regex, $body, $m) && isset($m[1])) {
                $candidate = trim((string)$m[1]);
                // A configured extractor is only authoritative when the value is
                // recognised by this provider's configured result mappings, error map,
                // or is a conventional numeric response code. This keeps network/operator
                // labels and other metadata out of the response-code field without any
                // provider-specific or carrier-specific hardcoding.
                if ($candidate !== '' && (preg_match('/^\d{2,8}$/', $candidate) || self::response_code_is_success($api, $candidate) || self::response_code_is_failure($api, $candidate) || array_key_exists($candidate, self::code_map($api)))) return $candidate;
            }
            if (is_array($decoded)) {
                $v = self::json_path($decoded, $pattern);
                if ($v !== null && $v !== '') return (string)$v;
            }
        }
        if (is_array($decoded)) {
            $v = self::find_first_key($decoded, array('message_id','messageId','msgid','msg_id','id','sms_id','smsid','reference','batch_id','messageid'));
            if ($v !== null && $v !== '') return (string)$v;
        }
        foreach (array('/message[_ -]?id["\']?\s*[:=]\s*["\']?([A-Za-z0-9._:-]+)/i','/msg[_ -]?id["\']?\s*[:=]\s*["\']?([A-Za-z0-9._:-]+)/i','/id["\']?\s*[:=]\s*["\']?([A-Za-z0-9._:-]+)/i') as $p) {
            if (preg_match($p, $body, $m)) return $m[1];
        }
        return '';
    }

    private static function extract_status($api, $body, $decoded){
        if (!empty($api->status_json_path) && is_array($decoded)) {
            $v = self::json_path($decoded, $api->status_json_path);
            if ($v !== null && $v !== '') return (string)$v;
        }
        if (is_array($decoded)) {
            $v = self::find_first_key($decoded, array('status','state','delivery_status','response'));
            if ($v !== null && $v !== '') return (string)$v;
        }
        if (preg_match('/status["\']?\s*[:=]\s*["\']?([A-Za-z0-9._:-]+)/i', $body, $m)) return $m[1];
        return '';
    }

    public static function provider_presets(){
        return array(
            'generic_get' => array(
                'label'=>'HTTP GET API',
                'success_pattern'=>'success|ok|accepted|submitted|sent',
                'failure_pattern'=>'error|failed|invalid|rejected',
                'message_id_pattern'=>'/^\d{3,5}\|[^|]+\|([^,\s|]+)/i',
                'code_pattern'=>'/^(\d{3,5})\|/i',
            ),
            'generic_post_form' => array(
                'label'=>'HTTP POST API',
                'success_pattern'=>'success|ok|accepted|submitted|sent',
                'failure_pattern'=>'error|failed|invalid|rejected'
            ),
            'generic_json' => array(
                'label'=>'JSON API',
                'success_pattern'=>'success|ok|true|accepted|submitted',
                'failure_pattern'=>'error|failed|false|invalid|rejected'
            ),
        );
    }

    private static function preset_for_api($api){
        $preset = !empty($api->provider_preset) ? sanitize_key($api->provider_preset) : '';
        $presets = self::provider_presets();
        return isset($presets[$preset]) ? $presets[$preset] : array();
    }

    private static function api_field_or_preset($api, $field, $default=''){
        if (isset($api->$field) && trim((string)$api->$field) !== '') return (string)$api->$field;
        $preset = self::preset_for_api($api);
        return isset($preset[$field]) ? (is_array($preset[$field]) ? wp_json_encode($preset[$field]) : (string)$preset[$field]) : $default;
    }

    private static function success_tokens($api){
        $raw = self::api_field_or_preset($api, 'success_pattern', 'success|ok|accepted|submitted|sent');
        $parts = preg_split('/[|,\n]+/', (string)$raw, -1, PREG_SPLIT_NO_EMPTY);
        return array_values(array_filter(array_map('trim', $parts), 'strlen'));
    }

    /**
     * Decide whether a response code is successful for one configured provider.
     * Numeric codes are never globally privileged: they must be present in that
     * provider's saved success pattern (or its explicitly selected preset).
     */
    public static function response_code_is_success($api, $code){
        $code = trim((string)$code);
        if (!$api || $code === '') return false;
        foreach (self::success_tokens($api) as $token) {
            if (strcasecmp($code, trim((string)$token)) === 0) return true;
            $regex = self::normalise_regex($token);
            if ($regex && @preg_match($regex, $code) === 1) return true;
        }
        return false;
    }

    /** An explicit failure code has meaning only for the selected provider. */
    public static function response_code_is_failure($api, $code){
        $code = trim((string)$code);
        if (!$api || $code === '') return false;
        $raw = self::api_field_or_preset($api, 'failure_pattern', 'error|failed|invalid|rejected');
        foreach (preg_split('/[|,\r\n]+/', $raw, -1, PREG_SPLIT_NO_EMPTY) as $token) {
            if (strcasecmp($code, trim($token)) === 0) return true;
        }
        return false;
    }

    /** Return a stable product-level status for dashboards and reports. */
    public static function canonical_job_status($job){
        $get = static function($key) use ($job) {
            return is_array($job) ? ($job[$key] ?? '') : ($job->$key ?? '');
        };
        $bucket = strtolower(trim((string)$get('status_bucket')));
        $provider_status = strtoupper(trim((string)$get('provider_status')));
        $sent_at = trim((string)$get('sent_at'));

        if (in_array($bucket, array('success','delivered'), true)) return 'delivered';
        if (in_array($bucket, array('sent','accepted','submitted'), true)) return 'accepted';
        if ($bucket === 'pending' && ($sent_at !== '' || in_array($provider_status, array('SUBMITTED','ACCEPTED','OK','SUCCESS','SENT','AWAITING_DLR','PENDING'), true))) return 'accepted';
        if ($bucket === 'failed') {
            $api_id = intval($get('api_id'));
            $code = trim((string)$get('err_code'));
            if ($api_id > 0 && $code !== '') {
                static $api_cache = array();
                if (!array_key_exists($api_id, $api_cache)) {
                    global $wpdb;
                    $api_cache[$api_id] = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_apis WHERE id=%d", $api_id));
                }
                if (self::response_code_is_success($api_cache[$api_id], $code)) return 'accepted';
            }
            return 'failed';
        }
        if (in_array($bucket, array('queued','skipped'), true)) return $bucket;
        return 'pending';
    }

    /** Aggregate the canonical status contract for a filtered set of jobs. */
    public static function delivery_summary($user_id=0, $since='', $until=''){
        global $wpdb;
        $jobs = BSMS_DB::table('jobs');
        $where = array('1=1');
        $params = array();
        if (intval($user_id) > 0) { $where[] = 'user_id=%d'; $params[] = intval($user_id); }
        if ((string)$since !== '') { $where[] = 'updated_at >= %s'; $params[] = (string)$since; }
        if ((string)$until !== '') { $where[] = 'updated_at < %s'; $params[] = (string)$until; }
        $sql = "SELECT status_bucket, provider_status, err_code, api_id, MAX(sent_at) sent_at, COUNT(*) row_count FROM {$wpdb->prefix}bsms_jobs WHERE ".implode(' AND ', $where)." GROUP BY status_bucket, provider_status, err_code, api_id, (sent_at IS NOT NULL)";
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE is built from fixed fragments in this function; values use placeholders.
        if ($params) $sql = $wpdb->prepare($sql, $params);
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Prepared on the line above.
        $rows = $wpdb->get_results($sql, ARRAY_A);
        $out = array('total'=>0,'submitted'=>0,'successful'=>0,'accepted'=>0,'delivered'=>0,'pending'=>0,'failed'=>0,'queued'=>0,'skipped'=>0);
        foreach ((array)$rows as $row) {
            $count = intval($row['row_count'] ?? 0);
            $status = self::canonical_job_status($row);
            $out['total'] += $count;
            if (isset($out[$status])) $out[$status] += $count;
            if (in_array($status, array('accepted','delivered'), true)) {
                $out['successful'] += $count;
                $out['submitted'] += $count;
            } elseif (in_array($status, array('pending','failed'), true)) {
                $out['submitted'] += $count;
            }
        }
        $out['successful_rate'] = $out['submitted'] ? round(($out['successful'] / $out['submitted']) * 100, 1) : 0;
        $final = $out['delivered'] + $out['failed'];
        $out['confirmed_delivery_rate'] = $final ? round(($out['delivered'] / $final) * 100, 1) : 0;
        return $out;
    }

    private static function code_map($api){
        $map = array();
        $preset = self::preset_for_api($api);
        if (!empty($preset['error_code_map']) && is_array($preset['error_code_map'])) $map = $preset['error_code_map'];
        if (!empty($api->error_code_map)) {
            $decoded = json_decode((string)$api->error_code_map, true);
            if (is_array($decoded)) $map = array_merge($map, $decoded);
            else {
                foreach (preg_split('/\r?\n/', (string)$api->error_code_map) as $line) {
                    if (strpos($line, '=') !== false) {
                        list($k,$v) = array_map('trim', explode('=', $line, 2));
                        if ($k !== '') $map[$k] = $v;
                    }
                }
            }
        }
        return $map;
    }

    public static function error_reason($code, $api=null){
        $code = trim((string)$code);
        $map = $api ? self::code_map($api) : array();
        return isset($map[$code]) ? $map[$code] : ($code !== '' ? sprintf(/* translators: %s: a value filled in when shown */ __('Provider response code %s', 'bulk-sms-portal'), $code) : __('Unknown provider response', 'bulk-sms-portal'));
    }

    private static function extract_code($api, $body, $decoded){
        $pattern = self::api_field_or_preset($api, 'code_pattern', '');
        if ($pattern) {
            $regex = self::normalise_regex($pattern);
            if ($regex && @preg_match($regex, $body, $m) && isset($m[1])) {
                $candidate = trim((string)$m[1]);
                // A configured extractor is only authoritative when the value is
                // recognised by this provider's configured result mappings, error map,
                // or is a conventional numeric response code. This keeps network/operator
                // labels and other metadata out of the response-code field without any
                // provider-specific or carrier-specific hardcoding.
                if ($candidate !== '' && (preg_match('/^\d{2,8}$/', $candidate) || self::response_code_is_success($api, $candidate) || self::response_code_is_failure($api, $candidate) || array_key_exists($candidate, self::code_map($api)))) return $candidate;
            }
        }
        if (is_array($decoded)) {
            // Prefer fields that are semantically response/error codes. A generic
            // `code` field is frequently used by gateways for operator/network
            // names (for example `Glo`) and must not be treated as a failure code.
            $v = self::find_first_key($decoded, array('error_code','status_code','responseCode','response_code','statusCode'));
            if ($v !== null && $v !== '') return (string)$v;
            $generic = self::find_first_key($decoded, array('code'));
            if ($generic !== null && $generic !== '') {
                $generic = trim((string)$generic);
                if (preg_match('/^\d{2,6}$/', $generic) || self::response_code_is_success($api, $generic) || self::response_code_is_failure($api, $generic) || array_key_exists($generic, self::code_map($api))) {
                    return $generic;
                }
            }
        }
        if (!is_array($decoded) && preg_match('/^\s*(\d{3,5})(?:\||\s|$)/', $body, $m)) return (string)$m[1];
        return '';
    }

    private static function extract_operator($decoded){
        if (!is_array($decoded)) return '';
        $v = self::find_first_key($decoded, array('operator','network','carrier','network_name','operator_name','mobile_network'));
        if ($v === null || is_array($v) || is_object($v)) return '';
        return sanitize_text_field((string)$v);
    }

    /**
     * Match provider outcome tokens only against fields that actually describe
     * outcome. JSON metadata such as operator/network/code/recipient must never
     * decide whether a message was accepted or rejected.
     */
    /** Provider wording that always means the message was not accepted. */
    private static function has_negative_wording($body, $decoded){
        $texts = array();
        if (is_array($decoded) && $decoded) {
            foreach (array('status','state','result','message','description','response_message','responseMessage','error','error_message','errorMessage') as $key) {
                $v = self::find_first_key($decoded, array($key));
                if ($v !== null && is_scalar($v) && !is_bool($v)) $texts[] = (string)$v;
            }
        } else {
            $texts[] = (string)$body;
        }
        foreach ($texts as $t) {
            if (preg_match('/\b(?:not\s+(?:been\s+)?(?:sent|accepted|delivered|submitted|successful|processed)|unsuccessful|insufficient|denied|unauthori[sz]ed|declined|blocked|failure|expired\s+(?:key|token|account)|invalid\s+(?:sender|number|recipient|credential|login|api))\b/i', $t)) return true;
        }
        return false;
    }

    private static function token_match($tokens, $body, $decoded){
        $semantic = array();
        if (is_array($decoded)) {
            foreach (array('status','state','delivery_status','result','message','description','response_message','responseMessage','error','error_message','errorMessage') as $key) {
                $v = self::find_first_key($decoded, array($key));
                if ($v !== null && !is_array($v) && !is_object($v) && trim((string)$v) !== '') $semantic[] = trim((string)$v);
            }
        }
        // Plain-text gateways have no field semantics, so the body remains the
        // only available evidence. Structured JSON is deliberately restricted
        // to the semantic fields collected above.
        // v3.4.2: callers pass an empty array for plain-text replies; that must
        // still mean "search the body". Previously plain-text replies were never
        // matched, so an "OK sent" answer was left as unconfirmed.
        $haystacks = (is_array($decoded) && $decoded) ? $semantic : array((string)$body);
        foreach ($tokens as $t) {
            $t = trim((string)$t);
            if ($t === '') continue;
            $is_explicit_regex = preg_match('/^([^A-Za-z0-9\s]).+\1[imsxuADSUXJ]*$/', $t) === 1;
            foreach ($haystacks as $haystack) {
                if ($is_explicit_regex && @preg_match($t, $haystack) === 1) return true;
                if (!$is_explicit_regex && preg_match('/(?:^|[^A-Za-z0-9])'.preg_quote($t,'/').'(?:$|[^A-Za-z0-9])/i', $haystack) === 1) return true;
            }
        }
        return false;
    }

    public static function parse_provider_response($api, $body, $recipient='', $decoded=null){
        $body = trim((string)$body);
        if ($decoded === null) $decoded = json_decode($body, true);
        $recipient_digits = preg_replace('/\D+/', '', (string)$recipient);

        // Multi-recipient URL-template gateways often return comma-separated per-number responses.
        $parts = preg_split('/\s*,\s*/', $body, -1, PREG_SPLIT_NO_EMPTY);
        $selected = '';
        foreach ($parts as $part) {
            $bits = explode('|', trim($part));
            $dest = isset($bits[1]) ? preg_replace('/\D+/', '', $bits[1]) : '';
            if ($recipient_digits && $dest && $dest === $recipient_digits) { $selected = trim($part); break; }
        }
        if ($selected === '' && count($parts) === 1) $selected = trim($parts[0]);

        $parse_body = $selected !== '' ? $selected : $body;
        $code = '';
        $dest = '';
        $msgid = '';
        if ($parse_body !== '' && preg_match('/^(\d{3,5})\|([^|,\s]*)\|?([^,\s|]*)/i', $parse_body, $m)) {
            $code = $m[1];
            $dest = isset($m[2]) ? $m[2] : '';
            $msgid = isset($m[3]) ? $m[3] : '';
        }
        if ($code === '') $code = self::extract_code($api, $parse_body, is_array($decoded) ? $decoded : array());
        if ($msgid === '') $msgid = self::extract_message_id($api, $parse_body, is_array($decoded) ? $decoded : array());
        if ($msgid === '') $msgid = self::extract_message_id($api, $body, is_array($decoded) ? $decoded : array());

        $success_codes = self::success_tokens($api);
        $failure_pattern = self::api_field_or_preset($api, 'failure_pattern', 'error|failed|invalid|rejected');
        $failure = $code !== '' && self::response_code_is_failure($api, $code);
        $success = $code !== '' ? (self::response_code_is_success($api, $code) && !$failure) : false;
        // A configured code pattern may extract a non-status field. Explicit
        // semantic statuses still govern when the code is not a recognised
        // provider success or failure code.
        if (!$success && !$failure) {
            $failure_hit = $failure_pattern ? self::token_match(preg_split('/[|,\n]+/', $failure_pattern, -1, PREG_SPLIT_NO_EMPTY), $parse_body, is_array($decoded) ? $decoded : array()) : false;
            // v3.4.2: wording such as "Message not sent" or "Insufficient credit"
            // must never be read as success because it contains "sent" or "ok".
            if (!$failure_hit && self::has_negative_wording($parse_body, is_array($decoded) ? $decoded : array())) $failure_hit = true;
            $failure = $failure_hit;
            $success = self::token_match($success_codes, $parse_body, is_array($decoded) ? $decoded : array()) && !$failure_hit;
        }
        // Unknown non-status scalars are metadata, not response codes. A provider
        // code must be supported by the configured mapping or a conventional numeric code.
        if ($code !== '' && !$failure && !$success && !preg_match('/^\d{2,8}$/', $code) && !array_key_exists($code, self::code_map($api))) $code = '';

        $raw_status = self::extract_status($api, $parse_body, is_array($decoded) ? $decoded : array());
        $operator = self::extract_operator(is_array($decoded) ? $decoded : array());
        // Some gateways put the mobile network in a generic `code` property.
        // Preserve it as diagnostic metadata, but never let it become a result
        // code unless the selected provider explicitly maps it as one.
        if ($operator === '' && is_array($decoded)) {
            $generic_code = self::find_first_key($decoded, array('code'));
            if ($generic_code !== null && !is_array($generic_code) && !is_object($generic_code)) {
                $candidate = trim((string)$generic_code);
                if ($candidate !== '' && !preg_match('/^\d{2,6}$/', $candidate) && !self::response_code_is_success($api, $candidate) && !self::response_code_is_failure($api, $candidate) && !array_key_exists($candidate, self::code_map($api))) {
                    $operator = sanitize_text_field($candidate);
                }
            }
        }

        // A provider response has three outcomes at send time: explicitly accepted,
        // explicitly rejected, or unconfirmed. HTTP 2xx by itself is not proof of
        // acceptance, and an unknown scalar (including an operator name) is not
        // proof of failure.
        $provider_status = $success ? ($raw_status !== '' ? strtoupper($raw_status) : 'SUBMITTED') : ($failure ? 'FAILED' : 'UNCONFIRMED');
        $reason = $failure && $code ? self::error_reason($code, $api) : ($success ? __('Message accepted by provider', 'bulk-sms-portal') : ($failure ? __('The SMS service rejected the message.', 'bulk-sms-portal') : __('The SMS service response did not confirm acceptance or rejection.', 'bulk-sms-portal')));
        return array(
            'success'=>$success,
            'confirmed_rejection'=>$failure,
            'unconfirmed'=>(!$success && !$failure),
            'code'=>$code,
            'destination'=>$dest,
            'provider_message_id'=>$msgid,
            'provider_status'=>$provider_status,
            'raw_status'=>$raw_status,
            'operator'=>$operator,
            'reason'=>$reason,
            'raw_part'=>$parse_body,
        );
    }

    private static function transport_error_help($url, $message){
        $message = (string)$message;
        $url = (string)$url;
        if (stripos($message, 'cURL error 7') !== false || stripos($message, 'Could not connect to server') !== false) {
            if (strpos($url, ':8443') !== false) {
                $host = wp_parse_url($url, PHP_URL_HOST);
                return sprintf(/* translators: %s: a value filled in when shown */ __('Your WordPress hosting server could not open an outbound connection to the SMS gateway on port 8443. The same URL may work in your browser because that is your local network, not the hosting server. Ask the host to allow outbound TCP/HTTPS connections to %s:8443, or request an API endpoint on a standard allowed port such as 443/8080.', 'bulk-sms-portal'), $host);
            }
            return __('Your WordPress hosting server could not connect to the provider endpoint. Check outbound firewall rules, DNS, provider IP restrictions, and the provider URL/port.', 'bulk-sms-portal');
        }
        return '';
    }

    private static function has_placeholders($text){
        return (bool)preg_match('/(@@[A-Za-z0-9_]+@@|\{\{?[A-Za-z0-9_]+(_url)?\}?\})/', (string)$text);
    }


    private static function maybe_exact_url_debug($url, $meta=array()){
        if (empty($meta['test'])) return array();
        if (!function_exists('current_user_can') || !current_user_can('manage_options')) return array();
        return array(
            'debug_note' => __('Safe diagnostic only. Credentials are never returned to the browser.', 'bulk-sms-portal'),
            'request_url' => self::redact_url((string)$url)
        );
    }

    private static function redact_url($url){
        $url = (string)$url;
        $url = preg_replace('/((?:password|pass)=)[^&\s]+/i', '$1***', $url);
        $url = preg_replace('/((?:username|user)=)[^&\s]+/i', '$1***', $url);
        $url = preg_replace('/(api[_-]?key=)[^&\s]+/i', '$1***', $url);
        return self::shorten($url, 1000);
    }

    private static function json_path($data, $path){
        if (!is_array($data) || trim((string)$path) === '') return null;
        $parts = explode('.', trim((string)$path));
        $cur = $data;
        foreach ($parts as $p) {
            if ($p === '') continue;
            if (is_array($cur) && array_key_exists($p, $cur)) $cur = $cur[$p];
            elseif (is_array($cur) && ctype_digit($p) && array_key_exists(intval($p), $cur)) $cur = $cur[intval($p)];
            else return null;
        }
        if (is_array($cur) || is_object($cur)) return wp_json_encode($cur);
        return $cur;
    }

    private static function find_first_key($arr, $keys){
        foreach ($keys as $k) {
            if (is_array($arr) && array_key_exists($k, $arr)) return $arr[$k];
        }
        foreach ($arr as $v) {
            if (is_array($v)) {
                $found = self::find_first_key($v, $keys);
                if ($found !== null) return $found;
            }
        }
        return null;
    }

    private static function normalise_regex($pattern){
        $pattern = trim((string)$pattern);
        if ($pattern === '') return '';
        if (preg_match('/^([^A-Za-z0-9\s]).+\1[imsxuADSUXJ]*$/', $pattern)) return $pattern;
        return '/' . str_replace('/', '\/', $pattern) . '/i';
    }

    private static function shorten($text, $len=300){
        $text = trim((string)$text);
        return strlen($text) > $len ? substr($text, 0, $len) . '...' : $text;
    }
}
