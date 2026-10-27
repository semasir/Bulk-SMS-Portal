<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Routing {
    public static function init(){
        add_action('rest_api_init', array(__CLASS__, 'routes'));
    }

    public static function routes(){
        register_rest_route('bsms/v1','/analytics/summary',array(
            'methods'=>'GET',
            'callback'=>array(__CLASS__,'analytics_summary'),
            'permission_callback'=>function(){ return class_exists('BSMS_Capabilities') && BSMS_Capabilities::can_manage_platform(); }
        ));
        register_rest_route('bsms/v1','/providers/health',array(
            'methods'=>'GET',
            'callback'=>array(__CLASS__,'provider_health'),
            'permission_callback'=>function(){ return class_exists('BSMS_Capabilities') && BSMS_Capabilities::can_manage_platform(); }
        ));
    }



    public static function mark_success($api_id, $route='normal'){
        self::upsert_health($api_id, $route, 'active', true, '');
    }

    public static function mark_failure($api_id, $route='normal', $error=''){
        self::upsert_health($api_id, $route, 'degraded', false, $error);
    }

    public static function upsert_health($api_id, $route, $status, $success, $error=''){
        global $wpdb;
        $t = BSMS_DB::table('provider_health');
        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_provider_health WHERE api_id=%d AND route=%s", intval($api_id), sanitize_text_field($route)));
        $now = BSMS_Util::now_gmt();

        if ($existing) {
            $data = array(
                'status'=>$status,
                'updated_at'=>$now,
                'last_error'=>sanitize_textarea_field($error)
            );
            if ($success) {
                $data['success_count'] = intval($existing->success_count) + 1;
                $data['last_success_at'] = $now;
            } else {
                $data['fail_count'] = intval($existing->fail_count) + 1;
                $data['last_failure_at'] = $now;
            }
            $wpdb->update($t, $data, array('id'=>intval($existing->id)));
        } else {
            $wpdb->insert($t, array(
                'api_id'=>intval($api_id),
                'route'=>sanitize_text_field($route),
                'status'=>$status,
                'success_count'=>$success ? 1 : 0,
                'fail_count'=>$success ? 0 : 1,
                'last_success_at'=>$success ? $now : null,
                'last_failure_at'=>$success ? null : $now,
                'last_error'=>sanitize_textarea_field($error),
                'updated_at'=>$now
            ));
        }
    }

    public static function log_usage($user_id, $username, $endpoint, $route, $status, $units=0, $cost_kobo=0, $meta=array()){
        global $wpdb;
        $wpdb->insert(BSMS_DB::table('api_usage'), array(
            'user_id'=>intval($user_id),
            'api_username'=>sanitize_text_field($username),
            'endpoint'=>sanitize_text_field($endpoint),
            'route'=>sanitize_text_field($route),
            'status'=>sanitize_text_field($status),
            'units'=>intval($units),
            'cost_kobo'=>intval($cost_kobo),
            'ip_address'=>class_exists('BSMS_Security') ? BSMS_Security::ip() : '',
            'meta_json'=>wp_json_encode($meta),
            'created_at'=>BSMS_Util::now_gmt()
        ));
    }

    public static function analytics_summary(){
        global $wpdb;
        $usage = BSMS_DB::table('api_usage');
        $jobs = BSMS_DB::table('jobs');
        $ledger = BSMS_DB::table('ledger');

        $today = gmdate('Y-m-d 00:00:00');
        $api_today = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_api_usage WHERE created_at >= %s", $today)));
        $api_failed = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_api_usage WHERE status='failed' AND created_at >= %s", $today)));
        $delivery = class_exists('BSMS_Providers') ? BSMS_Providers::delivery_summary(0, $today) : array();
        $sent = intval($delivery['submitted'] ?? 0);
        $accepted = intval($delivery['accepted'] ?? 0);
        $delivered = intval($delivery['delivered'] ?? 0);
        $failed = intval($delivery['failed'] ?? 0);
        $revenue = intval($wpdb->get_var($wpdb->prepare("SELECT SUM(amount_kobo) FROM {$wpdb->prefix}bsms_ledger WHERE type='credit' AND created_at >= %s", $today)));

        return array(
            'ok'=>true,
            'today'=>array(
                'api_requests'=>$api_today,
                'api_failed'=>$api_failed,
                'sms_jobs'=>$sent,
                'successful'=>intval($delivery['successful'] ?? ($accepted + $delivered)),
                'accepted'=>$accepted,
                'delivered'=>$delivered,
                'failed'=>$failed,
                'successful_submission_rate'=>floatval($delivery['successful_rate'] ?? 0),
                'confirmed_delivery_rate'=>floatval($delivery['confirmed_delivery_rate'] ?? 0),
                'revenue'=>BSMS_Util::money($revenue)
            )
        );
    }

    public static function provider_health(){
        global $wpdb;
        $t = BSMS_DB::table('provider_health');
        $apis = BSMS_DB::table('apis');
        $rows = $wpdb->get_results("SELECT h.*, a.name AS api_name FROM {$wpdb->prefix}bsms_provider_health h LEFT JOIN {$wpdb->prefix}bsms_apis a ON a.id=h.api_id ORDER BY h.updated_at DESC LIMIT 200", ARRAY_A);
        return array('ok'=>true,'items'=>$rows);
    }
}
