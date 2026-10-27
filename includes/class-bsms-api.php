<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_API {
    public static function generate_plain_key(){
        return 'bsms_' . wp_generate_password(48, false, false);
    }

    public static function hash_key($plain){
        return wp_hash_password($plain);
    }

    public static function prefix($plain){
        return substr($plain, 0, 14);
    }

    public static function create_key($user_id, $name='Default API Key', $daily_limit=1000, $allowed_ips=''){
        global $wpdb;
        $plain = self::generate_plain_key();
        $t = BSMS_DB::table('api_keys');
        $wpdb->insert($t, array(
            'user_id'=>intval($user_id),
            'key_name'=>sanitize_text_field($name ?: 'Default API Key'),
            'key_prefix'=>self::prefix($plain),
            'key_hash'=>self::hash_key($plain),
            'status'=>'active',
            'allowed_ips'=>sanitize_textarea_field($allowed_ips),
            'daily_limit'=>max(1, intval($daily_limit)),
            'created_at'=>BSMS_Util::now_gmt()
        ));
        return array('id'=>$wpdb->insert_id, 'plain_key'=>$plain, 'prefix'=>self::prefix($plain));
    }

    public static function authenticate_request(WP_REST_Request $request){
        $auth = $request->get_header('authorization');
        if (!$auth) $auth = BSMS_Util::server_value('HTTP_AUTHORIZATION');
        if (!$auth) $auth = BSMS_Util::server_value('REDIRECT_HTTP_AUTHORIZATION');

        $key = '';
        if ($auth && preg_match('/Bearer\s+(.+)/i', $auth, $m)) $key = trim($m[1]);
        if (!$key) $key = trim((string)$request->get_param('api_key'));

        if (!$key) return new WP_Error('missing_api_key', __('Missing API key.', 'bulk-sms-portal'), array('status'=>401));

        $prefix = self::prefix($key);
        global $wpdb;
        $t = BSMS_DB::table('api_keys');
        $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_api_keys WHERE key_prefix=%s AND status=%s", $prefix, 'active'));

        foreach ($rows as $row) {
            if (wp_check_password($key, $row->key_hash)) {
                // v3.4.1: suspended accounts cannot use the API.
                if (BSMS_API::account_suspended(intval($row->user_id))) {
                    return new WP_Error('account_suspended', __('This account is suspended.', 'bulk-sms-portal'), array('status'=>403));
                }
                $ip_check = self::check_ip($row, self::client_ip());
                if (is_wp_error($ip_check)) return $ip_check;

                $limit_check = self::check_rate_limit($row);
                if (is_wp_error($limit_check)) return $limit_check;

                $wpdb->update($t, array('last_used_at'=>BSMS_Util::now_gmt()), array('id'=>$row->id));
                return $row;
            }
        }

        return new WP_Error('invalid_api_key', __('Invalid API key.', 'bulk-sms-portal'), array('status'=>401));
    }

    public static function account_suspended($user_id){
        $user_id = intval($user_id);
        return (string)get_user_meta($user_id, 'bsms_account_status', true) === 'suspended' || (bool)get_user_meta($user_id, 'bsms_suspended', true);
    }

    public static function check_ip($key_row, $ip){
        $allowed = trim((string)$key_row->allowed_ips);
        if ($allowed === '') return true;
        $ips = array_filter(array_map('trim', preg_split('/[\r\n,]+/', $allowed)));
        if (in_array($ip, $ips, true)) return true;
        return new WP_Error('ip_not_allowed', __('This IP address is not allowed for this API key.', 'bulk-sms-portal'), array('status'=>403));
    }

    public static function check_rate_limit($key_row){
        $limit = max(1, intval($key_row->daily_limit));
        global $wpdb;
        $logs = BSMS_DB::table('api_logs');
        $since = gmdate('Y-m-d 00:00:00');
        $count = intval($wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}bsms_api_logs WHERE api_key_id=%d AND created_at >= %s",
            $key_row->id, $since
        )));
        if ($count >= $limit) {
            return new WP_Error('rate_limit_exceeded', __('Daily API request limit exceeded.', 'bulk-sms-portal'), array('status'=>429));
        }
        return true;
    }

    public static function client_ip(){
        // v3.4.1: one trusted source for the caller's IP (see BSMS_Security::ip()).
        return class_exists('BSMS_Security') ? BSMS_Security::ip() : BSMS_Util::server_value('REMOTE_ADDR');
    }

    public static function redact_log_data($value, $key=''){
        $sensitive = array('api_key','password','pass','token','secret','authorization','auth','access_token','refresh_token','client_secret');
        if (in_array(strtolower((string)$key), $sensitive, true)) return '[REDACTED]';
        if (is_array($value)) { $out=array(); foreach($value as $k=>$v) $out[$k]=self::redact_log_data($v,$k); return $out; }
        if (is_object($value)) return self::redact_log_data((array)$value,$key);
        return $value;
    }

    public static function log($user_id, $api_key_id, $endpoint, $method, $status_code, $success, $message='', $request=array(), $response=array()){
        global $wpdb;
        $request = self::redact_log_data($request);
        $response = self::redact_log_data($response);
        $t = BSMS_DB::table('api_logs');
        $wpdb->insert($t, array(
            'user_id'=>intval($user_id),
            'api_key_id'=>$api_key_id ? intval($api_key_id) : null,
            'endpoint'=>sanitize_text_field($endpoint),
            'method'=>sanitize_text_field($method),
            'ip_address'=>self::client_ip(),
            'status_code'=>intval($status_code),
            'success'=>$success ? 1 : 0,
            'message'=>sanitize_textarea_field($message),
            'request_json'=>wp_json_encode($request),
            'response_json'=>wp_json_encode($response),
            'created_at'=>BSMS_Util::now_gmt()
        ));
    }

    public static function public_response($data, $status=200){
        return new WP_REST_Response($data, $status);
    }

    public static function error_response(WP_Error $err){
        $status = 400;
        $data = $err->get_error_data();
        if (is_array($data) && !empty($data['status'])) $status = intval($data['status']);
        return new WP_REST_Response(array(
            'status'=>'error',
            'message'=>$err->get_error_message(),
            'error_code'=>$err->get_error_code()
        ), $status);
    }
}
