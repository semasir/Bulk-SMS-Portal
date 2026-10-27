<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Security {
    public static function can_manage(){
        if (class_exists('BSMS_Portal')) return BSMS_Portal::can_manage();
        if (function_exists('is_super_admin') && is_super_admin(get_current_user_id())) return true;
        return current_user_can('manage_options') || current_user_can('bsms_manage_platform');
    }

    /** Cloudflare edge ranges (https://www.cloudflare.com/ips/). Filterable. */
    public static function cloudflare_ranges(){
        return apply_filters('bsms_cloudflare_ranges', array(
            '173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','141.101.64.0/18','108.162.192.0/18',
            '190.93.240.0/20','188.114.96.0/20','197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/13',
            '104.24.0.0/14','172.64.0.0/13','131.0.72.0/22',
            '2400:cb00::/32','2606:4700::/32','2803:f800::/32','2405:b500::/32','2405:8100::/32','2a06:98c0::/29','2c0f:f248::/32',
        ));
    }

    public static function ip_in_cidr($ip, $cidr){
        $ip_bin = @inet_pton($ip);
        if ($ip_bin === false) return false;
        if (strpos($cidr, '/') === false) $cidr .= strlen($ip_bin) === 4 ? '/32' : '/128';
        list($net, $bits) = explode('/', $cidr, 2);
        $net_bin = @inet_pton($net);
        if ($net_bin === false || strlen($net_bin) !== strlen($ip_bin)) return false;
        $bits = intval($bits);
        $bytes = intdiv($bits, 8);
        if ($bytes && substr($ip_bin, 0, $bytes) !== substr($net_bin, 0, $bytes)) return false;
        $rest = $bits % 8;
        if ($rest === 0) return true;
        $mask = chr((0xff << (8 - $rest)) & 0xff);
        return (($ip_bin[$bytes] & $mask) === ($net_bin[$bytes] & $mask));
    }

    private static function ip_in_list($ip, $list){
        foreach ((array)$list as $cidr) {
            $cidr = trim((string)$cidr);
            if ($cidr !== '' && self::ip_in_cidr($ip, $cidr)) return true;
        }
        return false;
    }

    /** Proxies allowed to report the visitor IP: private/loopback addresses plus the "bsms_trusted_proxies" option. */
    private static function is_trusted_proxy($ip){
        if (filter_var($ip, FILTER_VALIDATE_IP) && !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return true;
        $extra = preg_split('/[\s,]+/', (string)get_option('bsms_trusted_proxies', ''), -1, PREG_SPLIT_NO_EMPTY);
        return self::ip_in_list($ip, $extra);
    }

    /**
     * v3.4.1: the visitor's real IP address.
     *
     * Forwarding headers can be set by anyone, so they are only believed when
     * the request really arrives from Cloudflare (CF-Connecting-IP) or from a
     * trusted proxy (X-Forwarded-For). Previously any caller could send a fake
     * header to dodge rate limits and API-key IP allowlists.
     */
    public static function ip(){
        $remote = trim(BSMS_Util::server_value('REMOTE_ADDR'));
        if (!filter_var($remote, FILTER_VALIDATE_IP)) return '';
        if (BSMS_Util::server_value('HTTP_CF_CONNECTING_IP') !== '' && self::ip_in_list($remote, self::cloudflare_ranges())) {
            $cf = trim(BSMS_Util::server_value('HTTP_CF_CONNECTING_IP'));
            if (filter_var($cf, FILTER_VALIDATE_IP)) return $cf;
        }
        if (BSMS_Util::server_value('HTTP_X_FORWARDED_FOR') !== '' && self::is_trusted_proxy($remote)) {
            $hops = array_reverse(array_map('trim', explode(',', BSMS_Util::server_value('HTTP_X_FORWARDED_FOR'))));
            foreach ($hops as $hop) {
                if (!filter_var($hop, FILTER_VALIDATE_IP)) break;
                if (!self::is_trusted_proxy($hop) && !self::ip_in_list($hop, self::cloudflare_ranges())) return $hop;
            }
        }
        return $remote;
    }

    /**
     * v3.6.1: did this request arrive over https? Believes forwarding headers
     * only from Cloudflare or a trusted proxy (same rule as ip()).
     */
    public static function request_is_https(){
        if (function_exists('is_ssl') && is_ssl()) return true;
        $remote = trim(BSMS_Util::server_value('REMOTE_ADDR'));
        if (!filter_var($remote, FILTER_VALIDATE_IP)) return false;
        if (BSMS_Util::server_value('HTTP_CF_VISITOR') !== '' && self::ip_in_list($remote, self::cloudflare_ranges())) {
            $v = json_decode(BSMS_Util::server_value('HTTP_CF_VISITOR'), true);
            if (is_array($v) && strtolower((string)($v['scheme'] ?? '')) === 'https') return true;
        }
        if (self::is_trusted_proxy($remote) || self::ip_in_list($remote, self::cloudflare_ranges())) {
            $proto = strtolower(trim(explode(',', BSMS_Util::server_value('HTTP_X_FORWARDED_PROTO'))[0]));
            if ($proto === 'https') return true;
            if (strtolower(BSMS_Util::server_value('HTTP_X_FORWARDED_SSL')) === 'on') return true;
        }
        return false;
    }

    public static function log($action, $message='', $meta=array(), $object_type='', $object_id=0, $user_id=0){
        global $wpdb;
        $t = BSMS_DB::table('activity_logs');
        $wpdb->insert($t, array(
            'user_id'=>intval($user_id),
            'actor_id'=>get_current_user_id(),
            'action'=>sanitize_text_field($action),
            'object_type'=>sanitize_text_field($object_type),
            'object_id'=>intval($object_id),
            'ip_address'=>self::ip(),
            'message'=>sanitize_textarea_field($message),
            'meta_json'=>wp_json_encode($meta),
            'created_at'=>BSMS_Util::now_gmt()
        ));
    }

    
    public static function throttle($key, $limit=60, $window=60){
        $key = 'bsms_rate_' . md5((string)$key);
        $data = get_transient($key);
        if (!is_array($data)) $data = array('count'=>0, 'start'=>time());
        if (time() - intval($data['start']) > intval($window)) $data = array('count'=>0, 'start'=>time());
        $data['count']++;
        set_transient($key, $data, intval($window));
        return intval($data['count']) <= intval($limit);
    }


    public static function dlr_token(){
        $token = trim((string)get_option('bsms_dlr_webhook_token', ''));
        if (!$token) {
            $token = wp_generate_password(40, false, false);
            update_option('bsms_dlr_webhook_token', $token, false);
        }
        return $token;
    }

    /** v3.4.2: each SMS provider gets its own delivery-report token. */
    public static function dlr_api_token($api_id){
        $api_id = absint($api_id);
        if (!$api_id) return self::dlr_token();
        $tokens = get_option('bsms_dlr_api_tokens', array());
        if (!is_array($tokens)) $tokens = array();
        if (empty($tokens[$api_id])) {
            $tokens[$api_id] = wp_generate_password(40, false, false);
            update_option('bsms_dlr_api_tokens', $tokens, false);
        }
        return (string)$tokens[$api_id];
    }

    /** Delivery-report URL for one provider (or the legacy shared URL when no provider is given). */
    public static function dlr_callback_url($api_id=0){
        $api_id = absint($api_id);
        if (!$api_id) return add_query_arg('token', rawurlencode(self::dlr_token()), rest_url('bsms/v1/dlr'));
        return add_query_arg(array('api'=>$api_id, 'token'=>rawurlencode(self::dlr_api_token($api_id))), rest_url('bsms/v1/dlr'));
    }

    /**
     * Who is calling the delivery-report endpoint?
     * Returns array(ok, api_id, legacy). A provider-specific token only
     * authorises updates for that provider's messages; the old shared token is
     * still accepted for existing provider set-ups but with stricter matching.
     */
    public static function dlr_auth(WP_REST_Request $request){
        $supplied = (string)$request->get_param('token');
        if ($supplied === '') $supplied = (string)$request->get_header('x-bsms-dlr-token');
        if ($supplied === '') return array('ok'=>false, 'api_id'=>0, 'legacy'=>false);
        $api_id = absint($request->get_param('api'));
        if ($api_id) {
            $tokens = get_option('bsms_dlr_api_tokens', array());
            $expected = is_array($tokens) && !empty($tokens[$api_id]) ? (string)$tokens[$api_id] : '';
            return array('ok'=>$expected !== '' && hash_equals($expected, $supplied), 'api_id'=>$api_id, 'legacy'=>false);
        }
        return array('ok'=>hash_equals(self::dlr_token(), $supplied), 'api_id'=>0, 'legacy'=>true);
    }

    public static function verify_dlr_request(WP_REST_Request $request){
        $auth = self::dlr_auth($request);
        return !empty($auth['ok']);
    }

    public static function recent($limit=200){
        global $wpdb;
        $t = BSMS_DB::table('activity_logs');
        return $wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_activity_logs ORDER BY id DESC LIMIT %d", intval($limit)));
    }
}
