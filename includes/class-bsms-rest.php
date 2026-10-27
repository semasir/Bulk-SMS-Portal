<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_REST {
    public static function can_manage_platform(){
        return class_exists('BSMS_Capabilities') ? BSMS_Capabilities::can_manage_platform() : (current_user_can('manage_options') || current_user_can('bsms_manage_platform'));
    }
    public static function can_access_portal(){
        return class_exists('BSMS_Capabilities') ? BSMS_Capabilities::can('portal') : (is_user_logged_in() && self::can_manage_platform());
    }
    public static function can_send_sms(){
        $cap = class_exists('BSMS_Capabilities') ? BSMS_Capabilities::can('send') : (is_user_logged_in() && self::can_manage_platform());
        if (!$cap) return false;
        return !class_exists('BSMS_Entitlements') || BSMS_Entitlements::allows_action('send');
    }
    public static function can_action($action){
        $cap = class_exists('BSMS_Capabilities') ? BSMS_Capabilities::can($action) : self::can_access_portal();
        if (!$cap) return false;
        return !class_exists('BSMS_Entitlements') || BSMS_Entitlements::allows_action($action);
    }
    public static function can_feature($feature){
        if (!self::can_access_portal()) return false;
        if (self::can_manage_platform()) return true;
        return !class_exists('BSMS_Entitlements') || BSMS_Entitlements::is_enabled($feature);
    }
    private static function forbidden($message='You are not permitted to perform this action.'){
        return class_exists('BSMS_Capabilities') ? BSMS_Capabilities::forbidden($message) : new WP_REST_Response(array('ok'=>false,'error'=>$message),403);
    }
    public static function init(){ add_action('rest_api_init', array(__CLASS__, 'routes')); }

    private static function pagination_args($r = null, $default = 20, $max = 100){
        $page = 1; $per_page = $default;
        if ($r instanceof WP_REST_Request) {
            $page = max(1, intval($r->get_param('page')));
            $per_page = intval($r->get_param('per_page'));
        } else {
            $page = max(1, intval(isset($_GET['page']) ? $_GET['page'] : 1)); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Page number for a list; the REST request is already signed in.
            $per_page = intval(isset($_GET['per_page']) ? $_GET['per_page'] : $default); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Rows per page for a list; the REST request is already signed in.
        }
        if ($per_page <= 0) $per_page = $default;
        $per_page = min($max, max(1, $per_page));
        return array($page, $per_page, ($page - 1) * $per_page);
    }

    private static function paginated_response($items, $total, $page, $per_page, $extra = array()){
        $total = intval($total);
        $per_page = max(1, intval($per_page));
        $page = max(1, intval($page));
        return array_merge(array(
            'ok' => true,
            'items' => array_values(is_array($items) ? $items : array()),
            'page' => $page,
            'per_page' => $per_page,
            'total' => $total,
            'total_pages' => max(1, (int)ceil($total / $per_page)),
        ), is_array($extra) ? $extra : array());
    }

    public static function routes(){
        register_rest_route('bsms/v1','/api-details',array(
            'methods'=>'GET',
            'callback'=>array(__CLASS__,'api_details'),
            'permission_callback'=>function(){return BSMS_REST::can_action('api');}
        ));
        register_rest_route('bsms/v1','/api-credentials/regenerate',array(
            'methods'=>'POST',
            'callback'=>array(__CLASS__,'api_credentials_regenerate'),
            'permission_callback'=>function(){return BSMS_REST::can_action('api');}
        ));
        register_rest_route('bsms/v1','/profile',array('methods'=>'GET','callback'=>array(__CLASS__,'profile_get'),'permission_callback'=>function(){return BSMS_REST::can_action('profile');}));
        register_rest_route('bsms/v1','/profile',array('methods'=>'POST','callback'=>array(__CLASS__,'profile_save'),'permission_callback'=>function(){return BSMS_REST::can_action('profile');}));
        register_rest_route('bsms/v1','/profile/password',array('methods'=>'POST','callback'=>array(__CLASS__,'profile_password'),'permission_callback'=>function(){return BSMS_REST::can_access_portal();}));
        register_rest_route('bsms/v1','/portal-data',array('methods'=>'GET','callback'=>array(__CLASS__,'portal_data'),'permission_callback'=>function(){return BSMS_REST::can_action('portal');}));
        register_rest_route('bsms/v1','/entitlements',array('methods'=>'GET','callback'=>array(__CLASS__,'entitlements_current'),'permission_callback'=>function(){return BSMS_REST::can_access_portal();}));
        register_rest_route('bsms/v1','/paystack/init',array('methods'=>'POST','callback'=>array(__CLASS__,'paystack_init'),'permission_callback'=>function(){return BSMS_REST::can_action('funding');}));
        register_rest_route('bsms/v1','/paystack/verify',array('methods'=>'POST','callback'=>array(__CLASS__,'paystack_verify'),'permission_callback'=>function(){return BSMS_REST::can_action('funding');}));
        register_rest_route('bsms/v1','/funding/manual',array('methods'=>'POST','callback'=>array(__CLASS__,'manual_funding'),'permission_callback'=>function(){return BSMS_REST::can_action('funding') && BSMS_REST::can_feature('manual_funding');}));
        register_rest_route('bsms/v1','/funding/requests',array('methods'=>'GET','callback'=>array(__CLASS__,'funding_requests'),'permission_callback'=>function(){return BSMS_REST::can_action('funding');}));
        register_rest_route('bsms/v1','/funding/proof-upload',array('methods'=>'POST','callback'=>array(__CLASS__,'funding_proof_upload'),'permission_callback'=>function(){return BSMS_REST::can_action('funding');}));
        register_rest_route('bsms/v1','/funding/requests/(?P<id>\d+)/proof',array('methods'=>'GET','callback'=>array(__CLASS__,'funding_proof_view'),'permission_callback'=>function(){return BSMS_REST::can_action('funding');}));
        register_rest_route('bsms/v1','/campaign/send',array('methods'=>'POST','callback'=>array(__CLASS__,'campaign_send'),'permission_callback'=>function(){return BSMS_REST::can_send_sms();}));
        register_rest_route('bsms/v1','/campaign/estimate',array('methods'=>'POST','callback'=>array(__CLASS__,'campaign_estimate'),'permission_callback'=>function(){return BSMS_REST::can_action('compose');}));
        register_rest_route('bsms/v1','/campaign/status/(?P<id>\d+)',array('methods'=>'GET','callback'=>array(__CLASS__,'campaign_status'),'permission_callback'=>function(){return BSMS_REST::can_action('history');}));
        register_rest_route('bsms/v1','/groups',array('methods'=>'GET','callback'=>array(__CLASS__,'groups'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/groups',array('methods'=>'POST','callback'=>array(__CLASS__,'create_group'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/groups/import-csv',array('methods'=>'POST','callback'=>array(__CLASS__,'import_group_csv'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));

        register_rest_route('bsms/v1','/groups/(?P<id>\d+)',array('methods'=>'GET','callback'=>array(__CLASS__,'group_detail'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/groups/(?P<id>\d+)/rename',array('methods'=>'POST','callback'=>array(__CLASS__,'group_rename'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/groups/(?P<id>\d+)/numbers',array('methods'=>'POST','callback'=>array(__CLASS__,'group_add_numbers'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/groups/(?P<id>\d+)/numbers/(?P<number_id>\d+)',array('methods'=>'DELETE','callback'=>array(__CLASS__,'group_delete_number'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/groups/(?P<id>\d+)/replace',array('methods'=>'POST','callback'=>array(__CLASS__,'group_replace_numbers'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/groups/(?P<id>\d+)/append-csv',array('methods'=>'POST','callback'=>array(__CLASS__,'group_append_csv'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/groups/(?P<id>\d+)',array('methods'=>'DELETE','callback'=>array(__CLASS__,'group_delete'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/reports/export',array('methods'=>'GET','callback'=>array(__CLASS__,'reports_export'),'permission_callback'=>function(){return BSMS_REST::can_action('reports');}));
        register_rest_route('bsms/v1','/groups/(?P<group_id>\d+)',array('methods'=>'DELETE','callback'=>array(__CLASS__,'delete_group'),'permission_callback'=>function(){return BSMS_REST::can_action('groups');}));
        register_rest_route('bsms/v1','/templates',array('methods'=>'GET','callback'=>array(__CLASS__,'templates'),'permission_callback'=>function(){return BSMS_REST::can_action('compose') && BSMS_REST::can_feature('templates');}));
        register_rest_route('bsms/v1','/templates',array('methods'=>'POST','callback'=>array(__CLASS__,'save_template'),'permission_callback'=>function(){return BSMS_REST::can_action('compose') && BSMS_REST::can_feature('templates');}));
        register_rest_route('bsms/v1','/templates/(?P<template_id>\d+)',array('methods'=>'DELETE','callback'=>array(__CLASS__,'delete_template'),'permission_callback'=>function(){return BSMS_REST::can_action('compose') && BSMS_REST::can_feature('templates');}));
        register_rest_route('bsms/v1','/sender-ids',array('methods'=>'GET','callback'=>array(__CLASS__,'sender_ids'),'permission_callback'=>function(){return BSMS_REST::can_action('sender_ids');}));
        register_rest_route('bsms/v1','/sender-ids/apply',array('methods'=>'POST','callback'=>array(__CLASS__,'apply_sender'),'permission_callback'=>function(){return BSMS_REST::can_action('sender_ids');}));
        register_rest_route('bsms/v1','/reports',array('methods'=>'GET','callback'=>array(__CLASS__,'reports'),'permission_callback'=>function(){return BSMS_REST::can_action('reports');}));
        register_rest_route('bsms/v1','/reports/(?P<id>\d+)',array('methods'=>'GET','callback'=>array(__CLASS__,'report_detail'),'permission_callback'=>function(){return BSMS_REST::can_action('reports');}));
        register_rest_route('bsms/v1','/reports/(?P<id>\d+)/jobs/(?P<job_id>\d+)/status',array('methods'=>'POST','callback'=>array(__CLASS__,'report_job_status'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/reports/(?P<id>\d+)/jobs/(?P<job_id>\d+)/sync',array('methods'=>'POST','callback'=>array(__CLASS__,'report_job_sync'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/reports/(?P<id>\d+)/sync-pending',array('methods'=>'POST','callback'=>array(__CLASS__,'report_sync_pending'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        

        register_rest_route('bsms/v1','/notifications/preferences',array('methods'=>'GET','callback'=>array(__CLASS__,'notification_preferences'),'permission_callback'=>function(){return BSMS_REST::can_action('notifications');}));
        register_rest_route('bsms/v1','/notifications/preferences',array('methods'=>'POST','callback'=>array(__CLASS__,'save_notification_preferences'),'permission_callback'=>function(){return BSMS_REST::can_action('notifications');}));
        register_rest_route('bsms/v1','/notices/dismiss',array('methods'=>'POST','callback'=>array('BSMS_Portal','dismiss_notice'),'permission_callback'=>function(){return is_user_logged_in();}));
        register_rest_route('bsms/v1','/notifications/logs',array('methods'=>'GET','callback'=>array(__CLASS__,'notification_logs'),'permission_callback'=>function(){return BSMS_REST::can_action('notifications');}));
        register_rest_route('bsms/v1','/api-keys',array('methods'=>'GET','callback'=>array(__CLASS__,'user_api_keys'),'permission_callback'=>function(){return BSMS_REST::can_action('api');}));
        register_rest_route('bsms/v1','/api-keys',array('methods'=>'POST','callback'=>array(__CLASS__,'create_user_api_key'),'permission_callback'=>function(){return BSMS_REST::can_action('api');}));
        register_rest_route('bsms/v1','/api-keys/(?P<id>\d+)/revoke',array('methods'=>'POST','callback'=>array(__CLASS__,'revoke_user_api_key'),'permission_callback'=>function(){return BSMS_REST::can_action('api');}));
        register_rest_route('bsms-api/v1','/sms/send',array('methods'=>'POST','callback'=>array(__CLASS__,'api_sms_send'),'permission_callback'=>'__return_true'));
        register_rest_route('bsms-api/v1','/account/balance',array('methods'=>'GET','callback'=>array(__CLASS__,'api_balance'),'permission_callback'=>'__return_true'));
        register_rest_route('bsms-api/v1','/sms/report/(?P<campaign_id>\d+)',array('methods'=>'GET','callback'=>array(__CLASS__,'api_report'),'permission_callback'=>'__return_true'));
        register_rest_route('bsms-api/v1','/sender-ids',array('methods'=>'GET','callback'=>array(__CLASS__,'api_sender_ids'),'permission_callback'=>'__return_true'));
        register_rest_route('bsms-api/v1','/sender-ids/apply',array('methods'=>'POST','callback'=>array(__CLASS__,'api_sender_apply'),'permission_callback'=>'__return_true'));
        register_rest_route('bsms-api/v1','/webhook/dlr',array('methods'=>'POST','callback'=>array('BSMS_DLR','webhook'),'permission_callback'=>array('BSMS_DLR','authorise_webhook')));
        register_rest_route('bsms/v1','/admin/users/(?P<id>\d+)/status',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_user_status'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/users/(?P<id>\d+)',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_user_update'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/users/(?P<id>\d+)/reset-api',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_user_reset_api'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/apis',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_api_save'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/apis/(?P<id>\d+)',array('methods'=>'DELETE','callback'=>array(__CLASS__,'admin_api_delete'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/apis/(?P<id>\d+)/test-balance',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_api_test_balance'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/apis/(?P<id>\d+)/test-send',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_api_test_send'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/sender-requests/(?P<id>\d+)',array('methods'=>'DELETE','callback'=>array(__CLASS__,'admin_sender_delete'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/sender-requests/(?P<id>\d+)',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_sender_update'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/default-sender',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_default_sender_save'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/summary',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_summary'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/users',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_users'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/credit-user',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_credit_user'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/apis',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_apis'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/api-balances',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_api_balances'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/price-list',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_price_list_get'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/price-list',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_price_list_save'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/pricing',array('methods'=>'GET','callback'=>array(__CLASS__,'pricing_get'),'permission_callback'=>function(){return BSMS_REST::can_action('portal');}));
        register_rest_route('bsms/v1','/admin/sender-requests',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_sender_requests'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/sender-requests/(?P<id>\d+)/(?P<action>approve|reject)',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_sender_action'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/notices',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_notices'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/broadcast',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_broadcast'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/funding-requests',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_funding_requests'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/funding-requests/(?P<id>\d+)/(?P<action>approve|reject|verify)',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_funding_action'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        // v2.8.0 Stage 3: front-end owner control centre endpoints.
        register_rest_route('bsms/v1','/admin/platform-settings',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_platform_settings_get'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/platform-settings',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_platform_settings_save'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/platform-health',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_platform_health'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/activity',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_activity'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/help-content',array('methods'=>'GET','callback'=>array(__CLASS__,'help_content_get'),'permission_callback'=>function(){return BSMS_REST::can_action('portal');}));
        register_rest_route('bsms/v1','/admin/help-content',array('methods'=>'GET','callback'=>array(__CLASS__,'admin_help_content_get'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/help-content',array('methods'=>'POST','callback'=>array(__CLASS__,'admin_help_content_save'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
        register_rest_route('bsms/v1','/admin/help-content/(?P<id>[A-Za-z0-9_-]+)',array('methods'=>'DELETE','callback'=>array(__CLASS__,'admin_help_content_delete'),'permission_callback'=>function(){return BSMS_REST::can_manage_platform();}));
    }








    public static function entitlements_current(){
        return array('ok'=>true,'entitlements'=>class_exists('BSMS_Entitlements')?BSMS_Entitlements::matrix(get_current_user_id()):array());
    }





    private static function canonical_campaign_counts($campaign_ids){
        global $wpdb;
        $campaign_ids = array_values(array_filter(array_map('intval', (array)$campaign_ids)));
        if (!$campaign_ids) return array();
        $jobs = BSMS_DB::table('jobs');
        $rows = $wpdb->get_results($wpdb->prepare("SELECT campaign_id, status_bucket, provider_status, err_code, api_id, sent_at FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id IN (" . implode(',', array_fill(0, count($campaign_ids), '%d')) . ')', $campaign_ids), ARRAY_A);
        $out = array();
        foreach ((array)$rows as $row) {
            $cid = intval($row['campaign_id']);
            if (!isset($out[$cid])) $out[$cid] = array('job_total'=>0,'queued_count'=>0,'pending_count'=>0,'accepted_count'=>0,'success_count'=>0,'failed_count'=>0,'skipped_count'=>0,'duplicate_count'=>0,'invalid_count'=>0);
            $out[$cid]['job_total']++;
            $status = class_exists('BSMS_Providers') ? BSMS_Providers::canonical_job_status($row) : strtolower((string)$row['status_bucket']);
            if ($status === 'delivered') $out[$cid]['success_count']++;
            elseif ($status === 'accepted') $out[$cid]['accepted_count']++;
            elseif (isset($out[$cid][$status.'_count'])) $out[$cid][$status.'_count']++;
            if ((string)$row['err_code'] === 'DUPLICATE') $out[$cid]['duplicate_count']++;
            if ((string)$row['err_code'] === 'INVALID_NUMBER') $out[$cid]['invalid_count']++;
        }
        return $out;
    }




    public static function profile_get(){
        $user = wp_get_current_user();
        if (!$user || !$user->ID) return new WP_REST_Response(array('ok'=>false,'error'=>__('Not logged in.', 'bulk-sms-portal')), 401);
        return array(
            'ok'=>true,
            'id'=>$user->ID,
            'username'=>$user->user_login,
            'email'=>$user->user_email,
            'first_name'=>get_user_meta($user->ID, 'first_name', true),
            'last_name'=>get_user_meta($user->ID, 'last_name', true),
            'display_name'=>$user->display_name,
            'phone'=>get_user_meta($user->ID, 'bsms_phone', true),
            'roles'=>array_values((array)$user->roles),
            'registered'=>$user->user_registered,
        );
    }

    public static function profile_save(WP_REST_Request $r){
        $user = wp_get_current_user();
        if (!$user || !$user->ID) return new WP_REST_Response(array('ok'=>false,'error'=>__('Not logged in.', 'bulk-sms-portal')), 401);
        $email = sanitize_email((string)$r->get_param('email'));
        $first = sanitize_text_field((string)$r->get_param('first_name'));
        $last = sanitize_text_field((string)$r->get_param('last_name'));
        $display = sanitize_text_field((string)$r->get_param('display_name'));
        $phone = sanitize_text_field((string)$r->get_param('phone'));
        if (!$email || !is_email($email)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Enter a valid email address.', 'bulk-sms-portal')), 400);
        $owner = email_exists($email);
        if ($owner && intval($owner) !== intval($user->ID)) return new WP_REST_Response(array('ok'=>false,'error'=>__('This email address is already used by another account.', 'bulk-sms-portal')), 400);
        // v3.4.1: changing the login email needs the current password, so a
        // borrowed or hijacked session cannot take the account over.
        if (strtolower($email) !== strtolower((string)$user->user_email)) {
            $current = (string)$r->get_param('current_password');
            if ($current === '') return new WP_REST_Response(array('ok'=>false,'code'=>'password_required','error'=>__('Enter your current password to change your email address.', 'bulk-sms-portal')), 400);
            if (!wp_check_password($current, $user->user_pass, $user->ID)) return new WP_REST_Response(array('ok'=>false,'code'=>'password_incorrect','error'=>__('Your current password is incorrect.', 'bulk-sms-portal')), 400);
        }
        $data = array('ID'=>$user->ID, 'user_email'=>$email);
        if ($display !== '') $data['display_name'] = $display;
        $updated = wp_update_user($data);
        if (is_wp_error($updated)) return new WP_REST_Response(array('ok'=>false,'error'=>$updated->get_error_message()), 400);
        update_user_meta($user->ID, 'first_name', $first);
        update_user_meta($user->ID, 'last_name', $last);
        update_user_meta($user->ID, 'bsms_phone', $phone);
        return array('ok'=>true,'message'=>__('Profile updated.', 'bulk-sms-portal'));
    }

    public static function profile_password(WP_REST_Request $r){
        $user = wp_get_current_user();
        if (!$user || !$user->ID) return new WP_REST_Response(array('ok'=>false,'error'=>__('Not logged in.', 'bulk-sms-portal')), 401);
        $current = (string)$r->get_param('current_password');
        $new = (string)$r->get_param('new_password');
        $confirm = (string)$r->get_param('confirm_password');
        if (!wp_check_password($current, $user->user_pass, $user->ID)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Current password is incorrect.', 'bulk-sms-portal')), 400);
        if (strlen($new) < 8) return new WP_REST_Response(array('ok'=>false,'error'=>__('New password must be at least 8 characters.', 'bulk-sms-portal')), 400);
        if ($new !== $confirm) return new WP_REST_Response(array('ok'=>false,'error'=>__('Passwords do not match.', 'bulk-sms-portal')), 400);
        wp_set_password($new, $user->ID);
        return array('ok'=>true,'message'=>__('Password changed. Please log in again on your next visit.', 'bulk-sms-portal'));
    }

    
    public static function api_credentials_regenerate(WP_REST_Request $r){
        if (!self::can_action('api')) return self::forbidden(__('API developer access is restricted to platform administrators.', 'bulk-sms-portal'));
        $user = wp_get_current_user();
        if (!$user || !$user->ID) {
            return new WP_REST_Response(array('ok'=>false,'error'=>__('Authentication required.', 'bulk-sms-portal')), 401);
        }

        $username = get_user_meta($user->ID, 'bsms_api_username', true);
        if (!$username) {
            $base = sanitize_user($user->user_login ?: ('user'.$user->ID), true);
            if (!$base) $base = 'user'.$user->ID;
            $username = strtolower($base) . '_' . substr(wp_hash($user->ID . '|' . microtime(true)), 0, 6);
        }

        try {
            $password = wp_generate_password(24, false, false);
        } catch (Throwable $e) {
            $password = substr(hash('sha256', wp_rand() . microtime(true) . $user->ID), 0, 24);
        }

        update_user_meta($user->ID, 'bsms_api_username', $username);
        update_user_meta($user->ID, 'bsms_api_password_hash', wp_hash_password($password));
        update_user_meta($user->ID, 'bsms_api_password_plain_once', $password);
        update_user_meta($user->ID, 'bsms_api_credentials_updated_at', current_time('mysql'));

        return array(
            'ok'=>true,
            'username'=>$username,
            'password'=>$password,
            'updated_at'=>current_time('mysql'),
            'one_time'=>true,
        );
    }

public static function api_details(){
        if (!self::can_action('api')) return self::forbidden(__('API developer access is restricted for this account.', 'bulk-sms-portal'));
        $user = wp_get_current_user();
        if (!$user || !$user->ID) return new WP_REST_Response(array('ok'=>false,'error'=>__('Authentication required.', 'bulk-sms-portal')), 401);
        $username = (string)$user->user_login;
        $base = home_url('/api');
        return array(
            'ok'=>true,
            'username'=>$username,
            'updated_at'=>'',
            'password_hint'=>__('For new integrations, create a revocable API key below. Existing account-password integrations remain compatible.', 'bulk-sms-portal'),
            'auth_mode'=>'api_key_preferred',
            'preferred_auth'=>__('Bearer API key over HTTPS', 'bulk-sms-portal'),
            // Share endpoint addresses without encouraging passwords in URLs.
            // Existing integrations using legacy query credentials still work.
            'send_url'=>$base.'/send',
            'balance_url'=>$base.'/balance',
            'status_url'=>$base.'/status',
            'quick_send_url'=>$base.'/send?username='.rawurlencode($username).'&password=YOUR_PASSWORD&sender=YOUR_SENDER_ID&recipients=234XXXXXXXXXX&message=YOUR_MESSAGE',
            'quick_balance_url'=>$base.'/balance?username='.rawurlencode($username).'&password=YOUR_PASSWORD',
            'quick_status_url'=>$base.'/status?username='.rawurlencode($username).'&password=YOUR_PASSWORD&messageid=MSG123',
            'response_codes'=>array(
                'NS1000'=>__('Request accepted for processing', 'bulk-sms-portal'),'NS1001'=>__('Message processed successfully', 'bulk-sms-portal'),'NS1002'=>__('Still processing', 'bulk-sms-portal'),'NS1100'=>__('Balance request successful', 'bulk-sms-portal'),
                'NS2001'=>__('Authentication failed', 'bulk-sms-portal'),'NS2002'=>__('Invalid or unavailable Sender ID', 'bulk-sms-portal'),'NS2003'=>__('Invalid recipient', 'bulk-sms-portal'),'NS2004'=>__('Invalid or missing message', 'bulk-sms-portal'),
                'NS2005'=>__('Insufficient balance', 'bulk-sms-portal'),'NS2008'=>__('Request limit exceeded', 'bulk-sms-portal'),'NS2009'=>__('Message ID not found', 'bulk-sms-portal'),'NS2010'=>__('Account/API access unavailable', 'bulk-sms-portal'),
                'NS3001'=>__('Message processing failed', 'bulk-sms-portal'),'NS9000'=>__('Service error', 'bulk-sms-portal')
            ),
        );
    }

    public static function pricing_get(?WP_REST_Request $r = null){
        global $wpdb;
        BSMS_Pricing::ensure_pricing_prefix_column();
        BSMS_Pricing::ensure_pricing_band_columns();
        $t = BSMS_DB::table('pricing');
        $rows = $wpdb->get_results(
            "SELECT id,title,country_code,scope,network,route,prefixes,min_qty,max_qty,price_kobo,active
             FROM {$wpdb->prefix}bsms_pricing
             WHERE active=1
             ORDER BY route ASC, min_qty ASC,
                      CASE WHEN max_qty=0 THEN 9223372036854775807 ELSE max_qty END ASC,
                      id DESC",
            ARRAY_A
        );
        $customer_id = get_current_user_id();
        foreach ($rows as &$row) {
            if (($row['scope'] ?? '') === 'network' || ($row['country_code'] ?? '') !== '234') {
                $row['price_kobo'] = BSMS_Pricing::customer_price_kobo($row['price_kobo'], $customer_id);
            }
        }
        unset($row);
        return array('ok'=>true,'items'=>$rows,'list'=>BSMS_Pricing::price_list($customer_id),'international_ready'=>BSMS_Pricing::international_service_ready());
    }

    /* v3.6.2: Pricing Manager reads and saves the whole price list at once. */
    public static function admin_price_list_get(){
        if (!self::can_manage_platform()) return self::forbidden();
        BSMS_Pricing::unify_price_list();
        return array('ok'=>true, 'list'=>BSMS_Pricing::price_list(0), 'notes'=>(array)get_option('bsms_price_list_notes', array()),
            'international_ready'=>BSMS_Pricing::international_service_ready(), 'nigeria_networks'=>BSMS_Pricing::prefixes_by_network('234'), 'country_names'=>BSMS_Pricing::country_names());
    }
    public static function admin_price_list_save(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $res = BSMS_Pricing::save_price_list($r->get_param('countries'));
        if (is_wp_error($res)) return new WP_REST_Response(array('ok'=>false, 'error'=>$res->get_error_message()), 400);
        delete_option('bsms_price_list_notes');
        if (class_exists('BSMS_Security')) BSMS_Security::log('price_list_saved', 'Price list saved');
        return array('ok'=>true, 'list'=>BSMS_Pricing::price_list(0));
    }



    private static function member_api_enabled($user_id){
        if (current_user_can('manage_options')) return true;
        if (intval(get_option('bsms_enable_member_api_access', 1)) === 1) return true;
        return intval(get_user_meta($user_id, 'bsms_enable_api_access', true)) === 1;
    }

    public static function admin_funding_requests(?WP_REST_Request $r = null){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        list($page, $per_page, $offset) = self::pagination_args($r, 20, 100);
        $t = BSMS_DB::table('funding_requests');
        $u = $wpdb->users;
        // v3.6.0: filters (status, search) and a count per status for the review queue.
        $where = array('1=1'); $args = array();
        $status = $r ? sanitize_key((string)$r->get_param('status')) : '';
        if (in_array($status, array('pending','approved','rejected','failed'), true)) { $where[] = 'fr.status=%s'; $args[] = $status; }
        $search = $r ? trim(sanitize_text_field((string)$r->get_param('search'))) : '';
        if ($search !== '') { $like = '%' . $wpdb->esc_like($search) . '%'; $where[] = '(fr.reference LIKE %s OR fr.depositor_name LIKE %s OR fr.bank_name LIKE %s OR u.display_name LIKE %s OR u.user_email LIKE %s)'; array_push($args, $like, $like, $like, $like, $like); }
        $w = implode(' AND ', $where);
        $count_sql = "SELECT COUNT(*) FROM {$wpdb->prefix}bsms_funding_requests fr LEFT JOIN $u u ON u.ID = fr.user_id WHERE $w";
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE is built from fixed fragments in this function; values use placeholders.
        $total = intval($wpdb->get_var($args ? $wpdb->prepare($count_sql, $args) : $count_sql));
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE is built from fixed fragments in this function; values use placeholders.
        $rows = $wpdb->get_results($wpdb->prepare("SELECT fr.*, u.display_name AS user_name, u.user_email AS user_email FROM {$wpdb->prefix}bsms_funding_requests fr LEFT JOIN $u u ON u.ID = fr.user_id WHERE $w ORDER BY fr.id DESC LIMIT %d OFFSET %d", array_merge($args, array($per_page, $offset))), ARRAY_A);
        $counts = array('all'=>0,'pending'=>0,'approved'=>0,'rejected'=>0);
        foreach ((array)$wpdb->get_results("SELECT status, COUNT(*) n FROM {$wpdb->prefix}bsms_funding_requests GROUP BY status", ARRAY_A) as $c) { $k = $c['status'] === 'completed' ? 'approved' : $c['status']; if (isset($counts[$k])) $counts[$k] += intval($c['n']); $counts['all'] += intval($c['n']); }
        foreach ($rows as &$row) {
            $meta = json_decode(isset($row['meta_json']) ? $row['meta_json'] : '', true);
            $row['note'] = is_array($meta) && isset($meta['note']) ? $meta['note'] : '';
            $row['amount_formatted'] = BSMS_Util::money(intval($row['amount_kobo']));
            $row['has_proof'] = !empty($row['proof_attachment_id']);
            $row['proof_view_path'] = $row['has_proof'] ? '/funding/requests/' . intval($row['id']) . '/proof' : '';
            $row += BSMS_Funding::actions((object)$row);
            $row['status_label'] = BSMS_Funding::status_label($row['status']);
        }
        unset($row);
        return self::paginated_response($rows, $total, $page, $per_page) + array('counts'=>$counts);
    }


    public static function admin_funding_action(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $id = intval($r['id']);
        $action = (string)$r['action'];
        $note = sanitize_textarea_field((string)$r->get_param('admin_note'));
        if ($action === 'approve') $result = BSMS_Funding::approve($id, $note, 'portal');
        elseif ($action === 'reject') $result = BSMS_Funding::reject($id, $note, 'portal');
        else $result = BSMS_Funding::verify($id);
        if (is_wp_error($result)) {
            $data = (array)$result->get_error_data();
            return new WP_REST_Response(array('ok'=>false,'code'=>$result->get_error_code(),'error'=>$result->get_error_message()), intval($data['status'] ?? 400));
        }
        return $result;
    }


    public static function admin_api_balances(){
        if (!self::can_manage_platform()) return self::forbidden();
        $items = array();
        foreach (BSMS_Providers::all_apis() as $api) {
            $route = !empty($api->assigned_route) ? $api->assigned_route : '';
            $balance = '';
            if (!empty($api->balance_url)) {
                $balance = BSMS_Providers::api_balance_by_id($api->id);
            }
            $items[] = array(
                'id'=>intval($api->id),
                'name'=>$api->name,
                'route'=>$route ?: 'unmapped',
                'active'=>intval($api->is_active),
                'balance'=>$balance ?: __('Not available', 'bulk-sms-portal'),
                'last_checked'=>current_time('mysql')
            );
        }
        return array('ok'=>true, 'items'=>$items);
    }

    
    
    



    public static function admin_default_sender_save(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $sender = BSMS_Util::validate_sender_id($r->get_param('sender_id'));
        if (!$sender) return new WP_REST_Response(array('ok'=>false,'error'=>__('Default Sender ID must be 1-11 valid characters.', 'bulk-sms-portal')), 400);
        update_option('bsms_default_sender', $sender);
        return array('ok'=>true, 'sender_id'=>$sender);
    }

    public static function admin_user_status(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $uid = intval($r['id']);
        if (!$uid || !get_user_by('id', $uid)) return new WP_REST_Response(array('ok'=>false,'error'=>__('User not found.', 'bulk-sms-portal')), 404);
        $status = sanitize_text_field($r->get_param('status'));
        if (!in_array($status, array('active','suspended'), true)) $status = 'active';
        update_user_meta($uid, 'bsms_account_status', $status);
        return array('ok'=>true, 'status'=>$status);
    }

    public static function admin_api_save(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        $t = BSMS_DB::table('apis');
        $id = intval($r->get_param('id'));
        $existing_api = null;
        if ($id > 0) {
            $existing_api = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_apis WHERE id=%d", $id));
        }
        $preset = sanitize_key($r->get_param('provider_preset') ?: 'generic_get');
        $method = strtoupper(sanitize_text_field($r->get_param('method') ?: 'GET'));
        $format = sanitize_text_field($r->get_param('request_format') ?: 'form');

        // Simple-mode safety: GET URL-template providers must not be saved as JSON by accident.
        if (!in_array($preset, array('generic_get','generic_http','generic_post_form','generic_json'), true)) $preset = 'generic_get';
        if (!$existing_api || $preset !== (string)($existing_api->provider_preset ?? '')) {
        if (in_array($preset, array('generic_get','generic_http'), true)) {
            $method = 'GET';
            $format = 'form';
        } elseif ($preset === 'generic_post_form') {
            $method = 'POST';
            $format = 'form';
        } elseif ($preset === 'generic_json') {
            $method = 'POST';
            $format = 'json';
        }

        }

        // PATCH semantics: absent edit fields must never erase a working provider mapping.
        $saved_value = static function($key) use ($r, $existing_api) {
            $value = $r->get_param($key);
            if ($value === null && $existing_api && property_exists($existing_api, $key)) return (string)$existing_api->$key;
            return $value === null ? '' : $value;
        };
        $success_pattern = sanitize_text_field($saved_value('success_pattern'));
        $failure_pattern = sanitize_text_field($saved_value('failure_pattern'));
        $code_pattern = sanitize_text_field($saved_value('code_pattern'));
        $message_id_pattern = sanitize_text_field($saved_value('message_id_pattern'));
        $balance_pattern = sanitize_text_field($saved_value('balance_pattern'));
        $error_code_map = sanitize_textarea_field($saved_value('error_code_map'));

        // Generic helpful defaults for HTTP gateways that return pipe-separated responses such as: code|recipient|message_id.
        if (!$existing_api && ($preset === 'generic_get' || $preset === 'generic_http')) {
            if ($success_pattern === '') $success_pattern = 'success|ok|accepted|submitted|sent';
            if ($failure_pattern === '') $failure_pattern = 'error|failed|invalid|rejected';
            if ($code_pattern === '') $code_pattern = '/^(\d{3,5})\|/i';
            if ($message_id_pattern === '') $message_id_pattern = '/^\d{3,5}\|[^|]+\|([^,\s|]+)/i';
            if ($balance_pattern === '') $balance_pattern = '/(?:BALANCE|CREDIT|CREDITS)?\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i';
        }


        $raw_send_url = BSMS_Providers::harmonise_api_url($r->get_param('send_url'), $preset, 'send');
        $raw_balance_url = BSMS_Providers::harmonise_api_url($r->get_param('balance_url'), $preset, 'balance');
        $raw_dlr_lookup_url = BSMS_Providers::harmonise_api_url($r->get_param('dlr_lookup_url'), $preset, 'balance');

        // Documentation examples/placeholders are never operational endpoints.
        // Keep DLR lookup explicitly unconfigured until the administrator supplies
        // a real provider endpoint. This rule is provider-neutral.
        if (preg_match('~^https?://(?:www\.)?provider\.example(?:/|$)~i', (string)$raw_dlr_lookup_url)) $raw_dlr_lookup_url = '';

        $api_username = BSMS_Providers::normalise_api_credential(sanitize_text_field($r->get_param('api_username')));
        $api_password_raw = $r->get_param('api_password');
        $api_password = is_string($api_password_raw) ? BSMS_Providers::normalise_api_credential(wp_unslash($api_password_raw)) : '';

        // Backward-compatible migration: if an admin pasted credentials directly into the URL,
        // extract them into the dedicated fields and replace the URL values with placeholders.
        $inferred = BSMS_Providers::infer_credentials_from_urls($raw_send_url, $raw_balance_url);
        if ($api_username === '' && !empty($inferred['username'])) $api_username = sanitize_text_field($inferred['username']);
        if ($api_password === '' && !empty($inferred['password'])) $api_password = trim((string)$inferred['password']);

        // v1.7.6: preserve existing stored credentials on edit if the fields are left blank.
        // This prevents a saved API from being converted into username=&password= during later edits.
        if ($existing_api) {
            if ($api_username === '' && !empty($existing_api->api_username)) {
                $api_username = trim((string)$existing_api->api_username);
            }
            if (($api_password === '' || $api_password === '********') && !empty($existing_api->api_password)) {
                $api_password = trim((string)$existing_api->api_password);
            }
        }

        $raw_send_url = BSMS_Providers::normalise_credential_placeholders($raw_send_url);
        $raw_balance_url = BSMS_Providers::normalise_credential_placeholders($raw_balance_url);
        $raw_dlr_lookup_url = BSMS_Providers::normalise_credential_placeholders($raw_dlr_lookup_url);

        $data = array(
            'name'=>sanitize_text_field($r->get_param('name')),
            'send_url'=>esc_url_raw($raw_send_url),
            'balance_url'=>esc_url_raw($raw_balance_url),
            'dlr_lookup_url'=>esc_url_raw($raw_dlr_lookup_url),
            'dlr_status_pattern'=>sanitize_text_field($saved_value('dlr_status_pattern')),
            'dlr_success_codes'=>sanitize_text_field($saved_value('dlr_success_codes')),
            'dlr_failure_codes'=>sanitize_text_field($saved_value('dlr_failure_codes')),
            'api_username'=>$api_username,
            'method'=>$method,
            'provider_preset'=>$preset,
            'request_format'=>$format,
            'payload_template'=>sanitize_textarea_field($saved_value('payload_template')),
            'extra_query'=>sanitize_textarea_field($saved_value('extra_query')),
            'auth_headers'=>sanitize_textarea_field(($r->get_param('auth_headers') === '' && $existing_api) ? (string)$existing_api->auth_headers : $saved_value('auth_headers')),
            'balance_pattern'=>$balance_pattern,
            'success_pattern'=>$success_pattern,
            'code_pattern'=>$code_pattern,
            'error_code_map'=>$error_code_map,
            'failure_pattern'=>$failure_pattern,
            'message_id_pattern'=>$message_id_pattern,
            'assigned_route'=>BSMS_Providers::normalise_route($r->get_param('assigned_route') ?: 'normal'),
            // v3.6.0: the service can be switched on or off from the editor.
            'is_active'=>($r->get_param('is_active') !== null) ? (BSMS_Util::bool_param($r->get_param('is_active')) ? 1 : 0) : ($existing_api ? intval($existing_api->is_active) : 1),
        );
        if ($api_password !== '' && $api_password !== '********') {
            $data['api_password'] = $api_password;
        }
        if (BSMS_DLR::delivery_code_lists_overlap($data['dlr_success_codes'], $data['dlr_failure_codes'])) return new WP_REST_Response(array('ok'=>false,'error'=>__('A delivery code cannot appear in both successful and failed results for the same provider.', 'bulk-sms-portal')), 400);
        if (!$data['name'] || !$data['send_url']) return new WP_REST_Response(array('ok'=>false,'error'=>__('API name and send URL are required.', 'bulk-sms-portal')), 400);
        $url_requires_username = (strpos($data['send_url'], '@@username@@') !== false || strpos($data['balance_url'], '@@username@@') !== false || strpos($data['dlr_lookup_url'], '@@username@@') !== false || preg_match('/[?&](?:username|user)=/i', $data['send_url'] . '&' . $data['balance_url'] . '&' . $data['dlr_lookup_url']));
        $url_requires_password = (strpos($data['send_url'], '@@password@@') !== false || strpos($data['balance_url'], '@@password@@') !== false || strpos($data['dlr_lookup_url'], '@@password@@') !== false || preg_match('/[?&](?:password|pass)=/i', $data['send_url'] . '&' . $data['balance_url'] . '&' . $data['dlr_lookup_url']));
        if ($url_requires_username && $api_username === '') {
            return new WP_REST_Response(array('ok'=>false,'error'=>__('API Username is required. Enter the provider username in the API Username field, then save again.', 'bulk-sms-portal')), 400);
        }
        if ($url_requires_password && $api_password === '') {
            return new WP_REST_Response(array('ok'=>false,'error'=>__('API Password is required. Enter the provider password in the API Password field, then save again.', 'bulk-sms-portal')), 400);
        }
        if ($id > 0) {
            $wpdb->update($t, $data, array('id'=>$id));
        } else {
            if (!isset($data['api_password'])) $data['api_password'] = '';
            $data['created_at'] = BSMS_Util::now_gmt();
            $wpdb->insert($t, $data);
            $id = $wpdb->insert_id;
        }
        if ($wpdb->last_error) {
            return new WP_REST_Response(array('ok'=>false,'error'=>__('Provider settings could not be saved. Check database health and try again.', 'bulk-sms-portal')), 500);
        }
        // The route shown in this editor must be the route actually used by campaign sending.
        // Test Send forces this provider ID, whereas campaigns resolve the canonical route option.
        // Keep both paths on the same provider without provider-specific logic.
        $saved_route = BSMS_Providers::normalise_route($data['assigned_route']);
        // One SMS service carries every message. Add-ons can give a service to one kind of message instead.
        if (!apply_filters('bsms_assign_api_route', false, intval($id), $saved_route)) update_option('bsms_default_api_id', intval($id));
        return array('ok'=>true, 'id'=>$id, 'route'=>$saved_route, 'credentials'=>array('username_present'=>$api_username !== '', 'password_present'=>$api_password !== '', 'username_length'=>strlen($api_username), 'password_length'=>strlen($api_password)));
    }

    public static function admin_api_delete(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        $t = BSMS_DB::table('apis');
        $wpdb->delete($t, array('id'=>intval($r['id'])));
        return array('ok'=>true);
    }

    public static function admin_api_test_balance(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $api_id = intval($r['id']);
        if ($api_id <= 0) return new WP_REST_Response(array('ok'=>false,'error'=>__('Invalid API ID.', 'bulk-sms-portal')), 400);
        if (!class_exists('BSMS_Providers') || !method_exists('BSMS_Providers', 'api_balance_debug_by_id')) {
            return new WP_REST_Response(array('ok'=>false,'error'=>__('Provider balance debugger is unavailable.', 'bulk-sms-portal')), 500);
        }
        $debug = BSMS_Providers::api_balance_debug_by_id($api_id);
        if (empty($debug['ok'])) {
            return new WP_REST_Response($debug, 400);
        }
        return array(
            'ok'=>true,
            'message'=>__('Balance checked successfully.', 'bulk-sms-portal'),
            'api_id'=>$api_id,
            'http_code'=>$debug['http_code'] ?? null,
            'balance'=>$debug['balance'] ?? '',
            'raw_response'=>$debug['raw_response'] ?? '',
            'request_url'=>$debug['request_url'] ?? '',
        );
    }

    public static function admin_api_test_send(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $api_id = intval($r['id']);
        if ($api_id <= 0) return new WP_REST_Response(array('ok'=>false,'error'=>__('Invalid API ID.', 'bulk-sms-portal')), 400);
        $recipient = sanitize_text_field($r->get_param('recipient'));
        $normalised_recipient = BSMS_Util::normalize_phone_e164($recipient, '234');
        if ($normalised_recipient) $recipient = $normalised_recipient;
        $sender = BSMS_Util::validate_sender_id($r->get_param('sender') ?: get_option('bsms_default_sender', 'SMS'));
        $message = sanitize_textarea_field($r->get_param('message') ?: __('Test SMS from API Manager', 'bulk-sms-portal'));
        if (!$recipient) return new WP_REST_Response(array('ok'=>false,'error'=>__('Recipient number is required.', 'bulk-sms-portal')), 400);
        if (!$sender) $sender = 'SMS';

        $route = BSMS_Providers::normalise_route($r->get_param('route') ?: 'normal');
        $result = BSMS_Providers::send_sms($recipient, $message, $sender, $route, array(
            'force_api_id'=>$api_id,
            'test'=>true,
            'job_id'=>0,
            'campaign_id'=>0,
        ));

        if (is_wp_error($result)) {
            $data = $result->get_error_data();
            return new WP_REST_Response(array(
                'ok'=>false,
                'error'=>$result->get_error_message(),
                'provider_code'=>is_array($data) ? ($data['provider_code'] ?? '') : '',
                'provider_reason'=>is_array($data) ? ($data['provider_reason'] ?? '') : '',
                'provider_operator'=>is_array($data) ? ($data['provider_operator'] ?? '') : '',
                'provider_raw_status'=>is_array($data) ? ($data['provider_raw_status'] ?? '') : '',
                'provider_message_id'=>is_array($data) ? ($data['provider_message_id'] ?? '') : '',
                'raw_response'=>is_array($data) ? ($data['raw'] ?? '') : '',
                'http_code'=>is_array($data) ? ($data['http_code'] ?? '') : '',
                'request_url'=>is_array($data) ? ($data['request_url'] ?? '') : '',
                'debug_note'=>is_array($data) ? ($data['debug_note'] ?? '') : '',
                'username_present'=>is_array($data) ? ($data['username_present'] ?? null) : null,
                'password_present'=>is_array($data) ? ($data['password_present'] ?? null) : null,
                'username_length'=>is_array($data) ? ($data['username_length'] ?? null) : null,
                'password_length'=>is_array($data) ? ($data['password_length'] ?? null) : null,
                'password_was_url_encoded_on_build'=>is_array($data) ? ($data['password_was_url_encoded_on_build'] ?? null) : null,
                'password_double_encoding_risk'=>is_array($data) ? ($data['password_double_encoding_risk'] ?? null) : null,
                'api_id'=>is_array($data) ? ($data['api_id'] ?? '') : '',
                'api_name'=>is_array($data) ? ($data['api_name'] ?? '') : '',
                'route'=>is_array($data) ? ($data['route'] ?? '') : '',
                'route_resolution'=>is_array($data) ? ($data['route_resolution'] ?? null) : null,
                'transport_help'=>is_array($data) ? ($data['transport_help'] ?? '') : '',
            ), 400);
        }

        return array(
            'ok'=>true,
            'message'=>__('The SMS service accepted the test message.', 'bulk-sms-portal'),
            'provider_code'=>$result['provider_code'] ?? '',
            'provider_reason'=>$result['provider_reason'] ?? '',
            'provider_operator'=>$result['provider_operator'] ?? '',
            'provider_raw_status'=>$result['provider_raw_status'] ?? '',
            'provider_status'=>$result['provider_status'] ?? '',
            'provider_message_id'=>$result['provider_message_id'] ?? '',
            'raw_response'=>$result['raw'] ?? '',
            'http_code'=>$result['http_code'] ?? '',
            'request_url'=>$result['request_url'] ?? '',
            'api_id'=>$result['api_id'] ?? '',
            'api_name'=>$result['api_name'] ?? '',
            'route'=>$result['route'] ?? '',
            'route_resolution'=>$result['route_resolution'] ?? null,
            'debug_note'=>$result['debug_note'] ?? '',
        );
    }



    public static function admin_sender_delete(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        $t = BSMS_DB::table('sender_ids');
        $wpdb->delete($t, array('id'=>intval($r['id'])));
        return array('ok'=>true);
    }

    public static function admin_sender_update(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        $t = BSMS_DB::table('sender_ids');
        $id = intval($r['id']);
        $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_sender_ids WHERE id=%d", $id));
        if (!$existing) return new WP_REST_Response(array('ok'=>false,'error'=>__('Sender ID request not found.', 'bulk-sms-portal')), 404);
        $sender = BSMS_Util::validate_sender_id($r->get_param('sender_id'));
        $status = sanitize_text_field($r->get_param('status'));
        $sample = sanitize_textarea_field($r->get_param('sample_message'));
        $admin_note = sanitize_textarea_field((string)$r->get_param('admin_note'));
        if (!$sender) return new WP_REST_Response(array('ok'=>false,'error'=>__('Invalid Sender ID.', 'bulk-sms-portal')), 400);
        if (!in_array($status, array('pending','approved','rejected'), true)) $status = 'pending';
        $data = array('sender_id'=>$sender,'sample_message'=>$sample,'status'=>$status,'updated_at'=>BSMS_Util::now_gmt());
        if ($admin_note !== '') $data['admin_note'] = $admin_note;
        $wpdb->update($t, $data, array('id'=>$id));
        $notice = array('email'=>false,'sms'=>false);
        if ($status !== (string)$existing->status && in_array($status,array('approved','rejected'),true) && class_exists('BSMS_Notifications')) {
            $notice = BSMS_Notifications::sender_decision($id, intval($existing->user_id), $sender, $status, $admin_note);
        }
        return array('ok'=>true,'notification'=>$notice);
    }
    public static function admin_summary(){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        $users = count_users();
        $wallets = BSMS_DB::table('wallets');
        $sender = BSMS_DB::table('sender_ids');
        $funding = BSMS_DB::table('funding_requests');
        $campaigns = BSMS_DB::table('campaigns');
        $jobs = BSMS_DB::table('jobs');
        $apis = BSMS_DB::table('apis');
        $pricing = BSMS_DB::table('pricing');
        $ledger = BSMS_DB::table('ledger');
        $today = gmdate('Y-m-d 00:00:00');

        $delivery_today = class_exists('BSMS_Providers') ? BSMS_Providers::delivery_summary(0, $today) : array();
        $accepted_today = intval($delivery_today['accepted'] ?? 0);
        $delivered_today = intval($delivery_today['delivered'] ?? 0);
        $submitted_today = intval($delivery_today['submitted'] ?? 0);
        $charged_today_kobo = abs(intval($wpdb->get_var($wpdb->prepare("SELECT COALESCE(SUM(amount_kobo),0) FROM {$wpdb->prefix}bsms_ledger WHERE type='sms_charge' AND amount_kobo < 0 AND created_at >= %s", $today))));
        $refunds_today_kobo = intval($wpdb->get_var($wpdb->prepare("SELECT COALESCE(SUM(amount_kobo),0) FROM {$wpdb->prefix}bsms_ledger WHERE reference LIKE %s AND amount_kobo > 0 AND created_at >= %s", $wpdb->esc_like('REFUND-JOB-') . '%', $today)));
        $failed_reason_rows = $wpdb->get_results($wpdb->prepare("SELECT status_bucket, provider_status, err_code, api_id, sent_at FROM {$wpdb->prefix}bsms_jobs WHERE status_bucket='failed' AND updated_at >= %s", $today), ARRAY_A);
        $failed_reason_counts = array();
        foreach ((array)$failed_reason_rows as $fr) {
            if (class_exists('BSMS_Providers') && BSMS_Providers::canonical_job_status($fr) !== 'failed') continue;
            $code = trim((string)($fr['err_code'] ?? '')) ?: 'UNKNOWN';
            $failed_reason_counts[$code] = intval($failed_reason_counts[$code] ?? 0) + 1;
        }
        arsort($failed_reason_counts);
        $failed_reasons = array();
        foreach (array_slice($failed_reason_counts, 0, 4, true) as $code=>$count) $failed_reasons[] = array('code'=>(string)$code, 'count'=>intval($count));
        $last_success = $wpdb->get_row($wpdb->prepare("SELECT provider_status, err_code, sender_id, to_phone_e164, updated_at FROM {$wpdb->prefix}bsms_jobs WHERE status_bucket IN('sent','pending','success') AND updated_at >= %s ORDER BY updated_at DESC LIMIT 1", $today), ARRAY_A);

        return array(
            'ok'=>true,
            'users'=>intval($users['total_users'] ?? 0),
            'active_users'=>intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->users} u LEFT JOIN {$wpdb->usermeta} um ON um.user_id=u.ID AND um.meta_key='bsms_account_status' WHERE (um.meta_value='active' OR um.umeta_id IS NULL)")),
            'suspended_users'=>intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key='bsms_account_status' AND meta_value='suspended'")),
            'total_sms_wallet_kobo'=>intval($wpdb->get_var("SELECT SUM(sms_balance_kobo) FROM {$wpdb->prefix}bsms_wallets")),
            'total_sms_units'=>BSMS_Wallet::estimated_units(intval($wpdb->get_var("SELECT SUM(sms_balance_kobo) FROM {$wpdb->prefix}bsms_wallets"))),
            'pending_senders'=>intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_sender_ids WHERE status='pending'")),
            'pending_funding'=>intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_funding_requests WHERE status='pending'")),
            'campaigns_today'=>intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_campaigns WHERE created_at >= %s", $today))),
            'messages_today'=>intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_jobs WHERE updated_at >= %s", $today))),
            'submitted_today'=>$submitted_today,
            'successful_today'=>intval($delivery_today['successful'] ?? ($accepted_today + $delivered_today)),
            'accepted_today'=>$accepted_today,
            'delivered_today'=>$delivered_today,
            'failed_today'=>intval($delivery_today['failed'] ?? 0),
            'pending_today'=>intval($delivery_today['pending'] ?? 0),
            'successful_submission_rate'=>floatval($delivery_today['successful_rate'] ?? 0),
            'confirmed_delivery_rate'=>floatval($delivery_today['confirmed_delivery_rate'] ?? 0),
            'pending_dlr'=>intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_jobs WHERE status_bucket IN('pending','sent')")),
            'refunds_today'=>intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_ledger WHERE reference LIKE %s AND created_at >= %s", $wpdb->esc_like('REFUND-JOB-') . '%', $today))),
            'refunds_today_kobo'=>$refunds_today_kobo,
            'charged_today_kobo'=>$charged_today_kobo,
            'net_sms_revenue_today_kobo'=>max(0, $charged_today_kobo - $refunds_today_kobo),
            'failed_reasons_today'=>$failed_reasons,
            'last_success_today'=>$last_success ?: null,
            'active_apis'=>intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_apis")),
            'pricing_rules'=>intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_pricing WHERE active=1")),
        );
    }

    public static function admin_users(?WP_REST_Request $r = null){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        list($page, $per_page, $offset) = self::pagination_args($r, 20, 100);
        $search = $r ? sanitize_text_field((string)$r->get_param('search')) : '';
        $status_filter = $r ? sanitize_key((string)$r->get_param('status')) : '';
        $sort = $r ? sanitize_key((string)$r->get_param('sort')) : 'newest';

        $args = array(
            'number'=>$per_page,
            'offset'=>$offset,
            'count_total'=>true,
            'fields'=>'all'
        );
        if ($search !== '') {
            $args['search'] = '*'.$search.'*';
            $args['search_columns'] = array('user_login','user_email','display_name');
        }
        if ($status_filter === 'suspended') {
            $args['meta_query'] = array(array('key'=>'bsms_account_status','value'=>'suspended','compare'=>'=')); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- Admin filter for suspended customers.
        } elseif ($status_filter === 'active') {
            $args['meta_query'] = array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- Admin filter for suspended customers.
                'relation'=>'OR',
                array('key'=>'bsms_account_status','compare'=>'NOT EXISTS'),
                array('key'=>'bsms_account_status','value'=>'suspended','compare'=>'!=')
            );
        }
        if ($sort === 'oldest') {
            $args['orderby'] = 'registered'; $args['order'] = 'ASC';
        } elseif ($sort === 'name') {
            $args['orderby'] = 'display_name'; $args['order'] = 'ASC';
        } else {
            $args['orderby'] = 'registered'; $args['order'] = 'DESC';
        }

        $query = new WP_User_Query($args);
        $users = $query->get_results();
        $total = intval($query->get_total());
        $w = BSMS_DB::table('wallets');
        $items = array();
        foreach ($users as $u) {
            BSMS_Wallet::ensure_wallet($u->ID);
            $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_wallets WHERE user_id=%d", $u->ID));
            $account_status = get_user_meta($u->ID, 'bsms_account_status', true); if (!$account_status) $account_status = 'active';
            $items[] = array(
                'id'=>$u->ID,
                'name'=>$u->display_name,
                'username'=>$u->user_login,
                'email'=>$u->user_email,
                'first_name'=>get_user_meta($u->ID, 'first_name', true),
                'last_name'=>get_user_meta($u->ID, 'last_name', true),
                'phone'=>get_user_meta($u->ID, 'bsms_phone', true),
                'roles'=>array_values((array)$u->roles),
                'role'=>implode(', ', array_values((array)$u->roles)),
                'registered'=>$u->user_registered,
                'status'=>$account_status,
                'sms_balance_kobo'=>intval($row->sms_balance_kobo),
                'units'=>BSMS_Wallet::estimated_units(intval($row->sms_balance_kobo)),
            );
            $items[count($items) - 1] = apply_filters('bsms_admin_user_row', $items[count($items) - 1], $u);
        }
        return self::paginated_response($items, $total, $page, $per_page);
    }


    private static function signed_kobo($value){
        $raw = is_string($value) ? trim(wp_unslash($value)) : trim((string)$value);
        $raw = str_replace(array(',', '₦', 'NGN', 'ngn', ' '), '', $raw);
        if ($raw === '' || !preg_match('/^-?\d+(?:\.\d{1,2})?$/', $raw)) return 0;
        return intval(round(floatval($raw) * 100));
    }

    public static function admin_credit_user(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $user_id = intval($r->get_param('user_id'));
        $amount = self::signed_kobo($r->get_param('amount_naira'));
        $reason = sanitize_text_field((string)$r->get_param('reason'));
        if (!$user_id || !get_user_by('id', $user_id)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Valid user is required.', 'bulk-sms-portal')), 400);
        if ($amount === 0) return new WP_REST_Response(array('ok'=>false,'error'=>__('Enter a non-zero amount. Use a minus sign to debit, for example -500.', 'bulk-sms-portal')), 400);
        $res = BSMS_Wallet::admin_adjust($user_id, $amount, $reason, 'portal');
        if (is_wp_error($res)) {
            $data = $res->get_error_data();
            $payload = array('ok'=>false,'code'=>$res->get_error_code(),'error'=>$res->get_error_message());
            if (is_array($data)) $payload = array_merge($payload, $data);
            return new WP_REST_Response($payload, $res->get_error_code() === 'insufficient_balance' ? 402 : 400);
        }
        $msg = $res['message'];
        return array('ok'=>true, 'message'=>$msg, 'amount_kobo'=>$amount);
    }

    public static function admin_user_update(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $user_id = intval($r['id']);
        $user = get_user_by('id', $user_id);
        if (!$user) return new WP_REST_Response(array('ok'=>false,'error'=>__('User not found.', 'bulk-sms-portal')), 404);
        // v3.4.1: only someone WordPress allows to edit this user may change their
        // details (for example, a platform manager cannot edit an administrator).
        if (!current_user_can('edit_user', $user_id)) return self::forbidden(__('You do not have permission to edit this account.', 'bulk-sms-portal'));
        $first = sanitize_text_field((string)$r->get_param('first_name'));
        $last = sanitize_text_field((string)$r->get_param('last_name'));
        $display = sanitize_text_field((string)$r->get_param('display_name'));
        $email = sanitize_email((string)$r->get_param('email'));
        $phone = sanitize_text_field((string)$r->get_param('phone'));
        $role = sanitize_key((string)$r->get_param('role'));
        $status = sanitize_key((string)$r->get_param('status'));
        if (!$email || !is_email($email)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Enter a valid email address.', 'bulk-sms-portal')), 400);
        $owner = email_exists($email);
        if ($owner && intval($owner) !== $user_id) return new WP_REST_Response(array('ok'=>false,'error'=>__('This email address is already used by another account.', 'bulk-sms-portal')), 400);
        $data = array('ID'=>$user_id, 'user_email'=>$email);
        if ($display !== '') $data['display_name'] = $display;
        $updated = wp_update_user($data);
        if (is_wp_error($updated)) return new WP_REST_Response(array('ok'=>false,'error'=>$updated->get_error_message()), 400);
        update_user_meta($user_id, 'first_name', $first);
        update_user_meta($user_id, 'last_name', $last);
        update_user_meta($user_id, 'bsms_phone', $phone);
        if (in_array($status, array('active','suspended'), true)) update_user_meta($user_id, 'bsms_account_status', $status);
        if ($role && get_role($role)) {
            if (!current_user_can('promote_users')) return self::forbidden(__('You do not have permission to change user roles.', 'bulk-sms-portal'));
            if ($role === 'administrator' && !current_user_can('manage_options')) return self::forbidden(__('Only a WordPress administrator may grant the Administrator role.', 'bulk-sms-portal'));
            if (!function_exists('get_editable_roles')) require_once ABSPATH . 'wp-admin/includes/user.php';
            $editable = array_keys(get_editable_roles());
            if (in_array($role, $editable, true)) {
                $wp_user = new WP_User($user_id);
                $wp_user->set_role($role);
            }
        }
        return array('ok'=>true,'message'=>__('User details updated.', 'bulk-sms-portal'));
    }

    public static function admin_user_reset_api(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $user_id = intval($r['id']);
        if (!$user_id || !get_user_by('id', $user_id)) return new WP_REST_Response(array('ok'=>false,'error'=>__('User not found.', 'bulk-sms-portal')), 404);
        global $wpdb;
        $t = BSMS_DB::table('api_keys');
        $wpdb->update($t, array('status'=>'revoked'), array('user_id'=>$user_id, 'status'=>'active'));
        $created = BSMS_API::create_key($user_id, __('Admin Reset API Key', 'bulk-sms-portal'), 1000, '');
        return array('ok'=>true,'message'=>__('API key reset. Copy the new key now.', 'bulk-sms-portal'),'api_key'=>$created['plain_key'],'key_prefix'=>$created['prefix']);
    }

    public static function admin_apis(?WP_REST_Request $r = null){
        if (!self::can_manage_platform()) return self::forbidden();
        list($page, $per_page, $offset) = self::pagination_args($r, 20, 100);
        $all = BSMS_Providers::all_apis();
        $total = is_array($all) ? count($all) : 0;
        $slice = array_slice(is_array($all) ? $all : array(), $offset, $per_page);
        $items = array();
        foreach ($slice as $api) {
            $items[] = array(
                'id'=>intval($api->id), 'name'=>$api->name, 'route'=>$api->assigned_route ?? '', 'active'=>intval($api->is_active),
                'send_url'=>$api->send_url ?? '', 'balance_url'=>$api->balance_url ?? '', 'dlr_lookup_url'=>$api->dlr_lookup_url ?? '', 'dlr_status_pattern'=>$api->dlr_status_pattern ?? '', 'dlr_success_codes'=>$api->dlr_success_codes ?? '', 'dlr_failure_codes'=>$api->dlr_failure_codes ?? '',
                'api_username'=>$api->api_username ?? '', 'has_api_password'=>!empty($api->api_password),
                'credential_diag'=>array('username_present'=>!empty($api->api_username),'password_present'=>!empty($api->api_password),'username_length'=>strlen((string)($api->api_username ?? '')),'password_length'=>strlen((string)($api->api_password ?? ''))),
                'method'=>$api->method ?? 'GET', 'success_pattern'=>$api->success_pattern ?? '', 'failure_pattern'=>$api->failure_pattern ?? '', 'message_id_pattern'=>$api->message_id_pattern ?? '',
                'provider_preset'=>$api->provider_preset ?? 'generic_get', 'request_format'=>$api->request_format ?? 'json', 'payload_template'=>$api->payload_template ?? '', 'extra_query'=>$api->extra_query ?? '', 'has_auth_headers'=>!empty($api->auth_headers),
                'balance_pattern'=>$api->balance_pattern ?? '', 'code_pattern'=>$api->code_pattern ?? '', 'error_code_map'=>$api->error_code_map ?? '',
                'is_main'=>intval($api->id) === intval(get_option('bsms_default_api_id', 0)) ? 1 : 0
            );
        }
        return self::paginated_response($items, $total, $page, $per_page);
    }


    public static function admin_sender_requests(?WP_REST_Request $r = null){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        list($page, $per_page, $offset) = self::pagination_args($r, 20, 100);
        $t = BSMS_DB::table('sender_ids');
        // v3.6.0: filters (status, search) and a count per status for the review queue.
        $where = array('1=1'); $args = array();
        $status = $r ? sanitize_key((string)$r->get_param('status')) : '';
        if (in_array($status, array('pending','approved','rejected'), true)) { $where[] = 's.status=%s'; $args[] = $status; }
        $search = $r ? trim(sanitize_text_field((string)$r->get_param('search'))) : '';
        if ($search !== '') { $like = '%' . $wpdb->esc_like($search) . '%'; $where[] = '(s.sender_id LIKE %s OR s.sample_message LIKE %s OR u.display_name LIKE %s OR u.user_email LIKE %s)'; array_push($args, $like, $like, $like, $like); }
        $w = implode(' AND ', $where);
        $from_sql = "FROM {$wpdb->prefix}bsms_sender_ids s LEFT JOIN {$wpdb->users} u ON u.ID = s.user_id WHERE $w";
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE is built from fixed fragments in this function; values use placeholders.
        $total = intval($wpdb->get_var($args ? $wpdb->prepare("SELECT COUNT(*) $from_sql", $args) : "SELECT COUNT(*) $from_sql"));
        $rows = $wpdb->get_results($wpdb->prepare("SELECT s.*, u.display_name AS user_name, u.user_email AS user_email $from_sql ORDER BY (s.status='pending') DESC, s.id DESC LIMIT %d OFFSET %d", array_merge($args, array($per_page, $offset))), ARRAY_A); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $from_sql is built from fixed fragments above; values use placeholders.
        foreach ($rows as &$r2) { $r2['user_label'] = $r2['user_name'] ? ($r2['user_name'] . ' <' . $r2['user_email'] . '>') : (sprintf(/* translators: %s: a value filled in when shown */ __('User #%s', 'bulk-sms-portal'), $r2['user_id'])); }
        unset($r2);
        $counts = array('all'=>0,'pending'=>0,'approved'=>0,'rejected'=>0);
        foreach ((array)$wpdb->get_results("SELECT status, COUNT(*) n FROM {$wpdb->prefix}bsms_sender_ids GROUP BY status", ARRAY_A) as $c) { if (isset($counts[$c['status']])) $counts[$c['status']] += intval($c['n']); $counts['all'] += intval($c['n']); }
        return self::paginated_response($rows, $total, $page, $per_page) + array('counts'=>$counts, 'default_sender'=>BSMS_Util::shared_sender());
    }


    public static function admin_sender_action(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        $t = BSMS_DB::table('sender_ids');
        $id = intval($r['id']);
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_sender_ids WHERE id=%d", $id));
        if (!$row) return new WP_REST_Response(array('ok'=>false,'error'=>__('Sender ID request not found.', 'bulk-sms-portal')), 404);
        $status = $r['action'] === 'approve' ? 'approved' : 'rejected';
        $admin_note = sanitize_textarea_field((string)$r->get_param('admin_note'));
        $data = array('status'=>$status,'updated_at'=>BSMS_Util::now_gmt());
        if ($admin_note !== '') $data['admin_note'] = $admin_note;
        $wpdb->update($t, $data, array('id'=>$id));
        $notice = class_exists('BSMS_Notifications')
            ? BSMS_Notifications::sender_decision($id, intval($row->user_id), (string)$row->sender_id, $status, $admin_note)
            : array('email'=>false,'sms'=>false);
        return array('ok'=>true,'notification'=>$notice);
    }

    public static function admin_broadcast(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $title = sanitize_text_field($r->get_param('title'));
        $message = sanitize_textarea_field($r->get_param('message'));
        if (!$title || !$message) return new WP_REST_Response(array('ok'=>false,'error'=>__('Title and message are required.', 'bulk-sms-portal')), 400);
        $type = sanitize_key($r->get_param('type') ?: 'information');
        $priority = sanitize_key($r->get_param('priority') ?: 'normal');
        $audience = sanitize_key($r->get_param('audience') ?: 'all');
        $status = sanitize_key($r->get_param('status') ?: 'published');
        $channel = sanitize_key($r->get_param('channel') ?: 'portal');
        $send_email = BSMS_Util::bool_param($r->get_param('send_email'));
        $selected_ids = array_values(array_unique(array_filter(array_map('absint', (array)$r->get_param('user_ids')))));
        if ($audience === 'selected' && !$selected_ids) return new WP_REST_Response(array('ok'=>false,'error'=>__('Choose at least one customer.', 'bulk-sms-portal')),400);
        if ($send_email && $status !== 'published') return new WP_REST_Response(array('ok'=>false,'error'=>__('Publish the notice before sending any emails.', 'bulk-sms-portal')), 400);

        global $wpdb;
        $admin_messages = BSMS_DB::table('admin_messages');
        $has_table = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $admin_messages)) === $admin_messages;
        // v3.6.0: a draft is saved for later and reaches nobody.
        if ($status === 'draft') {
            if ($has_table) $wpdb->insert($admin_messages, array('title'=>$title, 'message'=>$message, 'send_email'=>0, 'meta_json'=>wp_json_encode(array('type'=>$type,'priority'=>$priority,'audience'=>$audience,'status'=>'draft','reach'=>0,'emails_sent'=>0)), 'created_at'=>BSMS_Util::now_gmt()));
            return array('ok'=>true, 'draft'=>true, 'sent'=>0, 'emails_sent'=>0, 'emails_skipped'=>0, 'emails_failed'=>0);
        }

        $users = get_users(array('fields'=>'all'));
        $jobs = BSMS_DB::table('jobs');
        $wallets = BSMS_DB::table('wallets');
        $filtered = array();
        foreach ($users as $u) {
            $uid = absint($u->ID);
            $account_status = (string)get_user_meta($uid, 'bsms_account_status', true);
            $suspended = $account_status === 'suspended' || (bool)get_user_meta($uid, 'bsms_suspended', true);
            $include = true;
            if ($audience === 'selected') $include = in_array($uid, $selected_ids, true);
            elseif ($audience === 'active') $include = !$suspended;
            elseif ($audience === 'resellers') $include = in_array('reseller', (array)$u->roles, true) || (bool)get_user_meta($uid,'bsms_is_reseller',true);
            elseif ($audience === 'low_balance') {
                $prefs = BSMS_Notifications::get_preferences($uid);
                $include = BSMS_Wallet::estimated_units(BSMS_Wallet::get_balance_kobo($uid)) <= max(0,intval($prefs['low_balance_units']));
            } elseif ($audience === 'funded') $include = BSMS_Wallet::get_balance_kobo($uid) > 0;
            elseif ($audience === 'zero_balance') $include = BSMS_Wallet::get_balance_kobo($uid) <= 0;
            elseif ($audience === 'has_sent' || $audience === 'never_sent') {
                $has = (bool)$wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bsms_jobs WHERE user_id=%d LIMIT 1",$uid));
                $include = $audience === 'has_sent' ? $has : !$has;
            }
            if ($include) $filtered[] = $u;
        }

        $emails_sent = 0; $emails_skipped = 0; $emails_failed = 0;
        $broadcast_id = 'broadcast_'.gmdate('YmdHis').'_'.wp_generate_password(6,false,false);
        foreach ($filtered as $u) {
            $payload = array('title'=>$title,'message'=>$message,'type'=>$type,'priority'=>$priority,'audience'=>$audience,'channel'=>$channel,'status'=>$status,'created_at'=>BSMS_Util::now_gmt());
            add_user_meta($u->ID, 'bsms_popup_notice', wp_json_encode($payload));
            if ($send_email) {
                $marketing_allowed = $type !== 'promotion' || !empty(BSMS_Notifications::get_preferences($u->ID)['email_newsletter']);
                if (!$marketing_allowed) { $emails_skipped++; continue; }
                $ok = BSMS_Notifications::send_email($u->ID, $type === 'promotion' ? 'newsletter' : 'notice', $title, $message, array(
                    'idempotency_key'=>$broadcast_id.'_user_'.$u->ID,
                    'cta_label'=>sprintf(/* translators: %s: a value filled in when shown */ __('Open %s', 'bulk-sms-portal'), BSMS_Notifications::mail_from_name()), 'cta_url'=>BSMS_Util::page_url(), 'broadcast'=>true
                ));
                if ($ok) $emails_sent++; else $emails_failed++;
            }
        }
        if ($has_table) {
            $wpdb->insert($admin_messages, array('title'=>$title, 'message'=>$message, 'send_email'=>$send_email ? 1 : 0, 'meta_json'=>wp_json_encode(array('type'=>$type,'priority'=>$priority,'audience'=>$audience,'status'=>'published','reach'=>count($filtered),'emails_sent'=>$emails_sent)), 'created_at'=>BSMS_Util::now_gmt()));
        }
        return array('ok'=>true, 'sent'=>count($filtered), 'emails_sent'=>$emails_sent, 'emails_skipped'=>$emails_skipped, 'emails_failed'=>$emails_failed);
    }

    /** v3.6.0: notices sent so far (newest first), for Customer Notices. */
    public static function admin_notices(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb;
        list($page, $per_page, $offset) = self::pagination_args($r, 10, 50);
        $t = BSMS_DB::table('admin_messages');
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $t)) !== $t) return self::paginated_response(array(), 0, $page, $per_page);
        $total = intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_admin_messages"));
        $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_admin_messages ORDER BY id DESC LIMIT %d OFFSET %d", $per_page, $offset), ARRAY_A);
        $items = array();
        foreach ((array)$rows as $row) {
            $meta = json_decode((string)($row['meta_json'] ?? ''), true); if (!is_array($meta)) $meta = array();
            $items[] = array('id'=>intval($row['id']), 'title'=>$row['title'], 'message'=>wp_strip_all_tags((string)$row['message']), 'send_email'=>intval($row['send_email']),
                'type'=>$meta['type'] ?? 'information', 'priority'=>$meta['priority'] ?? 'normal', 'audience'=>$meta['audience'] ?? 'all',
                'status'=>$meta['status'] ?? 'published', 'reach'=>isset($meta['reach']) ? intval($meta['reach']) : null, 'emails_sent'=>isset($meta['emails_sent']) ? intval($meta['emails_sent']) : null, 'created_at'=>$row['created_at']);
        }
        return self::paginated_response($items, $total, $page, $per_page);
    }

    public static function notification_preferences(){
        return array('ok'=>true, 'preferences'=>BSMS_Notifications::get_preferences(get_current_user_id()));
    }

    public static function save_notification_preferences(WP_REST_Request $r){
        $prefs = BSMS_Notifications::save_preferences(get_current_user_id(), $r->get_params());
        return array('ok'=>true, 'preferences'=>$prefs);
    }

    public static function notification_logs(?WP_REST_Request $r = null){
        global $wpdb;
        list($page, $per_page, $offset) = self::pagination_args($r, 20, 100);
        $t = BSMS_DB::table('notifications');
        $uid = get_current_user_id();
        $total = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_notifications WHERE user_id=%d", $uid)));
        $items = $wpdb->get_results($wpdb->prepare(
            "SELECT id, type, channel, subject, message, status, cost_kobo, reference, created_at, sent_at FROM {$wpdb->prefix}bsms_notifications WHERE user_id=%d ORDER BY id DESC LIMIT %d OFFSET %d",
            $uid, $per_page, $offset
        ), ARRAY_A);
        return self::paginated_response($items, $total, $page, $per_page);
    }


    public static function user_api_keys(){
        if (!self::can_action('api')) return self::forbidden(__('API access is not available for this account.', 'bulk-sms-portal'));
        if (!self::member_api_enabled(get_current_user_id())) return new WP_REST_Response(array('ok'=>false,'error'=>__('API access is not enabled for this account.', 'bulk-sms-portal')), 403);
        global $wpdb;
        $t = BSMS_DB::table('api_keys');
        $items = $wpdb->get_results($wpdb->prepare(
            "SELECT id, key_name, key_prefix, status, allowed_ips, daily_limit, last_used_at, created_at
             FROM {$wpdb->prefix}bsms_api_keys WHERE user_id=%d ORDER BY id DESC",
            get_current_user_id()
        ), ARRAY_A);
        return array('ok'=>true, 'items'=>$items);
    }

    public static function create_user_api_key(WP_REST_Request $r){
        if (class_exists('BSMS_Entitlements')) {
            $gate=BSMS_Entitlements::enforce_limit('api_keys',1,get_current_user_id());
            if (is_wp_error($gate)) return new WP_REST_Response(array('ok'=>false,'code'=>$gate->get_error_code(),'error'=>$gate->get_error_message())+(array)$gate->get_error_data(),403);
        }
        if (!self::can_action('api')) return self::forbidden(__('API access is not available for this account.', 'bulk-sms-portal'));
        $uid = get_current_user_id();
        if (!self::member_api_enabled($uid)) return new WP_REST_Response(array('ok'=>false,'error'=>__('API access is not enabled for this account.', 'bulk-sms-portal')), 403);
        $name = sanitize_text_field($r->get_param('key_name') ?: 'Default API Key');
        $daily = intval($r->get_param('daily_limit') ?: 1000);
        $ips = sanitize_textarea_field($r->get_param('allowed_ips') ?: '');
        $created = BSMS_API::create_key($uid, $name, $daily, $ips);
        return array(
            'ok'=>true,
            'id'=>$created['id'],
            'key_prefix'=>$created['prefix'],
            'api_key'=>$created['plain_key'],
            'message'=>__('Copy this API key now. It will not be shown again.', 'bulk-sms-portal')
        );
    }

    public static function revoke_user_api_key(WP_REST_Request $r){
        if (!self::can_action('api')) return self::forbidden(__('API access is not available for this account.', 'bulk-sms-portal'));
        if (!self::member_api_enabled(get_current_user_id())) return new WP_REST_Response(array('ok'=>false,'error'=>__('API access is not enabled for this account.', 'bulk-sms-portal')), 403);
        global $wpdb;
        $t = BSMS_DB::table('api_keys');
        $id = intval($r['id']);
        $wpdb->update($t, array('status'=>'revoked'), array('id'=>$id, 'user_id'=>get_current_user_id()));
        return array('ok'=>true);
    }

    public static function api_auth(WP_REST_Request $r){
        $key = BSMS_API::authenticate_request($r);
        return $key;
    }

    public static function api_sms_send(WP_REST_Request $r){
        $key = self::api_auth($r);
        if (is_wp_error($key)) return BSMS_API::error_response($key);

        $uid = intval($key->user_id);
        if (class_exists('BSMS_Entitlements') && !BSMS_Entitlements::is_enabled('api_access',$uid)) {
            return BSMS_API::error_response(new WP_Error('bsms_feature_unavailable',__('API access is not enabled for this account.', 'bulk-sms-portal'),array('status'=>403)));
        }
        $numbers = $r->get_param('recipients');
        if (is_array($numbers)) {
            $flat = implode("\n", array_map('strval', $numbers));
        } else {
            $flat = (string)($r->get_param('numbers') ?: $r->get_param('to') ?: '');
        }

        $schedule = null;
        if ($r->get_param('schedule_at')) {
            try {
                $dt = new DateTime($r->get_param('schedule_at'), wp_timezone());
                $dt->setTimezone(new DateTimeZone('UTC'));
                if ($dt->getTimestamp() < time() - 60) return new WP_REST_Response(array('ok'=>false,'error'=>__('Schedule time cannot be in the past.', 'bulk-sms-portal')), 400);
                $schedule = $dt->format('Y-m-d H:i:s');
            } catch (Exception $e) {}
        }

        $parsed_numbers = BSMS_Util::parse_numbers($flat);
        $gate = BSMS_Campaigns::api_gate($uid, count(array_unique($parsed_numbers)), $schedule !== null);
        if (is_wp_error($gate)) {
            BSMS_API::log($uid, $key->id, '/sms/send', 'POST', 403, false, $gate->get_error_message(), array(), array());
            return BSMS_API::error_response($gate);
        }

        $result = BSMS_Campaigns::create(
            $uid,
            $r->get_param('campaign_name') ?: $r->get_param('name') ?: __('API Campaign', 'bulk-sms-portal'),
            (string)$r->get_param('message'),
            $parsed_numbers,
            (string)$r->get_param('sender_id'),
            BSMS_Providers::normalise_route($r->get_param('route')),
            $schedule,
            $r->get_param('dedupe') === false ? false : true
        );

        if (is_wp_error($result)) {
            BSMS_API::log($uid, $key->id, '/sms/send', 'POST', 400, false, $result->get_error_message(), $r->get_params(), array());
            return BSMS_API::error_response($result);
        }

        $w = BSMS_Wallet::get($uid);
        $response = array(
            'status'=>'success',
            'message'=>__('SMS request accepted', 'bulk-sms-portal'),
            'data'=>array(
                'campaign_id'=>intval($result['campaign_id']),
                'total_accepted'=>intval($result['recipients']),
                'sender_id'=>$result['sender_id'],
                'estimated_cost_kobo'=>intval($result['cost_kobo']),
                'estimated_cost_naira'=>BSMS_Util::naira_from_kobo($result['cost_kobo']),
                'wallet_balance'=>array(
                    'sms_kobo'=>intval($w->sms_balance_kobo),
                    'units'=>BSMS_Wallet::estimated_units(BSMS_Wallet::get_balance_kobo($uid))
                )
            )
        );

        BSMS_API::log($uid, $key->id, '/sms/send', 'POST', 201, true, 'Campaign created', $r->get_params(), $response);
        return BSMS_API::public_response($response, 201);
    }

    public static function api_balance(WP_REST_Request $r){
        $key = self::api_auth($r);
        if (is_wp_error($key)) return BSMS_API::error_response($key);

        $uid = intval($key->user_id);
        $w = BSMS_Wallet::get($uid);
        $response = array(
            'status'=>'success',
            'data'=>array(
                'currency'=>'NGN',
                'sms_wallet_kobo'=>intval($w->sms_balance_kobo),
                'sms_units'=>BSMS_Wallet::estimated_units(BSMS_Wallet::get_balance_kobo($uid))
            )
        );
        BSMS_API::log($uid, $key->id, '/account/balance', 'GET', 200, true, 'Balance checked', array(), $response);
        return BSMS_API::public_response($response, 200);
    }

    public static function api_report(WP_REST_Request $r){
        $key = self::api_auth($r);
        if (is_wp_error($key)) return BSMS_API::error_response($key);

        $uid = intval($key->user_id);
        $campaign_id = intval($r['campaign_id']);
        global $wpdb;
        $c = BSMS_DB::table('campaigns');
        $j = BSMS_DB::table('jobs');

        $campaign = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_campaigns WHERE id=%d AND user_id=%d", $campaign_id, $uid), ARRAY_A);
        if (!$campaign) {
            $err = new WP_Error('not_found', __('Campaign not found.', 'bulk-sms-portal'), array('status'=>404));
            BSMS_API::log($uid, $key->id, '/sms/report', 'GET', 404, false, 'Campaign not found', array('campaign_id'=>$campaign_id), array());
            return BSMS_API::error_response($err);
        }

        $jobs = $wpdb->get_results($wpdb->prepare(
            "SELECT to_phone_e164, recipient, sender_id, provider_message_id, provider_status, status_bucket, err_code, api_id, sent_at, delivered_at, cost_kobo
             FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d AND user_id=%d ORDER BY id ASC",
            $campaign_id, $uid
        ), ARRAY_A);

        $summary = array('total'=>0,'queued'=>0,'pending'=>0,'accepted'=>0,'delivered'=>0,'successful'=>0,'failed'=>0,'skipped'=>0);
        foreach ($jobs as &$job) {
            $summary['total']++;
            $canonical = class_exists('BSMS_Providers') ? BSMS_Providers::canonical_job_status($job) : strtolower((string)($job['status_bucket'] ?: 'pending'));
            if (!isset($summary[$canonical])) $summary[$canonical] = 0;
            $summary[$canonical]++;
            if (in_array($canonical, array('accepted','delivered'), true)) $summary['successful']++;
            $job['status'] = $canonical === 'failed' ? 'failed' : (in_array($canonical, array('accepted','delivered'), true) ? 'successful' : 'sending');
            $job['phone'] = $job['to_phone_e164'] ?: $job['recipient'];
            unset($job['to_phone_e164'], $job['recipient'], $job['status_bucket'], $job['provider_status'], $job['err_code'], $job['api_id']);
        }
        $summary['sent'] = $summary['accepted'];
        $summary['success'] = $summary['delivered'];
        $summary['sending'] = $summary['queued'] + $summary['pending'] + $summary['skipped'];
        unset($summary['queued'], $summary['pending'], $summary['accepted'], $summary['delivered'], $summary['sent'], $summary['success'], $summary['skipped']);

        $response = array(
            'status'=>'success',
            'data'=>array(
                'campaign'=>array(
                    'id'=>intval($campaign['id']),
                    'name'=>$campaign['name'],
                    'sender_id'=>$campaign['sender_id'],
                    'route'=>$campaign['route'],
                    'status'=>$summary['failed'] ? 'failed' : ($summary['sending'] ? 'sending' : 'successful'),
                    'created_at'=>$campaign['created_at'],
                    'schedule_at'=>$campaign['schedule_at'],
                    'pages'=>intval($campaign['pages']),
                    'recipients_count'=>intval($campaign['recipients_count'])
                ),
                'summary'=>$summary,
                'recipients'=>$jobs
            )
        );
        BSMS_API::log($uid, $key->id, '/sms/report', 'GET', 200, true, 'Report viewed', array('campaign_id'=>$campaign_id), $response);
        return BSMS_API::public_response($response, 200);
    }

    public static function api_sender_ids(WP_REST_Request $r){
        $key = self::api_auth($r);
        if (is_wp_error($key)) return BSMS_API::error_response($key);
        $uid = intval($key->user_id);

        global $wpdb;
        $t = BSMS_DB::table('sender_ids');
        $pending = $wpdb->get_col($wpdb->prepare("SELECT sender_id FROM {$wpdb->prefix}bsms_sender_ids WHERE user_id=%d AND status='pending'", $uid));

        $response = array(
            'status'=>'success',
            'data'=>array(
                'default_sender_id'=>BSMS_Campaigns::default_sender($uid),
                'approved_sender_ids'=>BSMS_Campaigns::approved_sender_ids($uid),
                'pending_sender_ids'=>$pending
            )
        );
        BSMS_API::log($uid, $key->id, '/sender-ids', 'GET', 200, true, 'Sender IDs listed', array(), $response);
        return BSMS_API::public_response($response, 200);
    }

    public static function api_sender_apply(WP_REST_Request $r){
        $key = self::api_auth($r);
        if (is_wp_error($key)) return BSMS_API::error_response($key);
        $uid = intval($key->user_id);

        $sender = BSMS_Util::validate_sender_id($r->get_param('sender_id'));
        if (!$sender) {
            $err = new WP_Error('invalid_sender_id', __('Sender ID must be 1-11 valid characters.', 'bulk-sms-portal'), array('status'=>422));
            return BSMS_API::error_response($err);
        }

        global $wpdb;
        $t = BSMS_DB::table('sender_ids');
        $wpdb->insert($t, array(
            'user_id'=>$uid,
            'sender_id'=>$sender,
            'status'=>'pending',
            'created_at'=>BSMS_Util::now_gmt(),
            'updated_at'=>BSMS_Util::now_gmt()
        ));

        $response = array('status'=>'success','message'=>__('Sender ID application submitted for approval.', 'bulk-sms-portal'));
        BSMS_API::log($uid, $key->id, '/sender-ids/apply', 'POST', 201, true, 'Sender application submitted', $r->get_params(), $response);
        return BSMS_API::public_response($response, 201);
    }

    private static function table_exists($table){
        global $wpdb;
        $like = $wpdb->esc_like($table);
        return (bool) $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $like));
    }


    private static function safe_rows($table, $where_sql='', $params=array(), $order='id DESC', $limit=5){
        global $wpdb;
        if (!self::table_exists($table)) return array();
        $sql = "SELECT * FROM $table" . ($where_sql ? " WHERE $where_sql" : '');
        if ($order) $sql .= ' ORDER BY ' . preg_replace('/[^a-zA-Z0-9_ ,.`-]/', '', $order);
        if ($limit) $sql .= ' LIMIT ' . absint($limit);
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Table and WHERE come from fixed values in this file; values use placeholders.
        if (!empty($params)) $sql = $wpdb->prepare($sql, $params);
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Prepared on the line above.
        $rows = $wpdb->get_results($sql, ARRAY_A);
        return is_array($rows) ? $rows : array();
    }
    private static function portal_bank_accounts(){
        $items = json_decode((string)get_option('bsms_bank_accounts_json', ''), true);
        if (!is_array($items)) $items = array();
        $accounts = array();
        foreach ($items as $row) {
            if (empty($row['active'])) continue;
            $bank = sanitize_text_field($row['bank'] ?? '');
            $account_name = sanitize_text_field($row['account_name'] ?? '');
            $account_number = preg_replace('/[^0-9]/', '', (string)($row['account_number'] ?? ''));
            $currency = strtoupper(preg_replace('/[^A-Z]/', '', (string)($row['currency'] ?? get_option('bsms_payment_currency','NGN'))));
            $instructions = sanitize_textarea_field($row['instructions'] ?? '');
            if (!$bank && !$account_name && !$account_number) continue;
            $accounts[] = array('bank'=>$bank,'account_name'=>$account_name,'account_number'=>$account_number,'currency'=>$currency ?: 'NGN','instructions'=>$instructions,'active'=>true);
        }
        if (!$accounts) {
            $legacy = array(
                'bank'=>sanitize_text_field(get_option('bsms_bank_name','')),
                'account_name'=>sanitize_text_field(get_option('bsms_bank_account_name','')),
                'account_number'=>preg_replace('/[^0-9]/', '', (string)get_option('bsms_bank_account_number','')),
                'currency'=>strtoupper(sanitize_text_field(get_option('bsms_payment_currency','NGN'))),
                'instructions'=>sanitize_textarea_field(get_option('bsms_manual_funding_instructions','')),
                'active'=>true
            );
            if ($legacy['bank'] || $legacy['account_name'] || $legacy['account_number']) $accounts[] = $legacy;
        }
        return $accounts;
    }

    private static function portal_payment_gateways(){
        $currency = strtoupper(sanitize_text_field(get_option('bsms_payment_currency','NGN')));
        $gateways = array();
        $defs = array(
            'paystack'=>array('label'=>__('Paystack', 'bulk-sms-portal'),'enabled'=>get_option('bsms_enable_paystack',1),'public'=>'bsms_paystack_public_key','secret'=>'bsms_paystack_secret_key','supports_checkout'=>true),
        );
        foreach ($defs as $id=>$g) {
            $enabled = !empty($g['enabled']);
            $pub = trim((string)get_option($g['public'], ''));
            $sec = trim((string)get_option($g['secret'], ''));
            $configured = $pub !== '' && $sec !== '';

            // v1.6.3: the public funding page must only expose gateways that are
            // intentionally enabled, fully configured, and currently connected to a
            // checkout initiation flow. Unconfigured/preview gateways belong in
            // wp-admin only, not in the customer wallet funding experience.
            if (!$enabled || !$configured || empty($g['supports_checkout'])) continue;

            $gateways[] = array(
                'id'=>$id,
                'label'=>$g['label'],
                'currency'=>$currency ?: 'NGN',
                'enabled'=>true,
                'configured'=>true,
                'supports_checkout'=>true,
                'init'=>'/paystack/init',
                'status'=>'ready',
                'message'=>__('Instant wallet funding.', 'bulk-sms-portal')
            );
        }
        // Add-ons add their own online payment methods here.
        $more = apply_filters('bsms_payment_gateways', array(), $currency);
        return is_array($more) ? array_merge($gateways, $more) : $gateways;
    }


    private static function funding_limits(){
        $min = max(0, floatval(get_option('bsms_minimum_funding_amount','0')));
        $max = max(0, floatval(get_option('bsms_maximum_funding_amount','0')));
        $presets_raw = (string)get_option('bsms_quick_funding_amounts','1000,2500,5000,10000,25000');
        $presets = array();
        foreach (preg_split('/[,\s]+/', $presets_raw) as $amt) {
            $v = floatval($amt);
            if ($v > 0) $presets[] = $v;
        }
        if (!$presets) $presets = array(1000,2500,5000,10000,25000);
        return array(
            'minimum_amount'=>$min,
            'maximum_amount'=>$max,
            'quick_amounts'=>array_values(array_slice(array_unique($presets),0,8))
        );
    }

    private static function validate_funding_amount_kobo($amount_kobo){
        $limits = self::funding_limits();
        $min_kobo = BSMS_Util::kobo($limits['minimum_amount']);
        $max_kobo = BSMS_Util::kobo($limits['maximum_amount']);
        if ($amount_kobo <= 0) {
            return new WP_Error('bsms_invalid_amount', __('Enter a valid amount.', 'bulk-sms-portal'));
        }
        if ($min_kobo > 0 && $amount_kobo < $min_kobo) {
            return new WP_Error('bsms_min_amount', sprintf(/* translators: %s: a value filled in when shown */ __('Minimum funding amount is %s.', 'bulk-sms-portal'), BSMS_Util::money($min_kobo)));
        }
        if ($max_kobo > 0 && $amount_kobo > $max_kobo) {
            return new WP_Error('bsms_max_amount', sprintf(/* translators: %s: a value filled in when shown */ __('Maximum funding amount is %s.', 'bulk-sms-portal'), BSMS_Util::money($max_kobo)));
        }
        return true;
    }


    public static function portal_data(){
        $uid = get_current_user_id();
        $defaults = array(
            'ok'=>true,
            'brand'=>BSMS_Util::brand_name(),
            'user'=>BSMS_Util::display_name($uid),
            'wallet'=>(object) array('user_id'=>$uid,'balance_kobo'=>0,'universal_balance_kobo'=>0,'sms_balance_kobo'=>0,'bonus_balance_kobo'=>0,'updated_at'=>''),
            'units'=>0,
            'sent'=>0,
            'delivery_rate'=>0,
            'recent'=>array(),
            'transactions'=>array(),
            'api_balance'=>'',
            'approved_senders'=>array(),
            'default_sender'=>BSMS_Util::shared_sender(),
            'route_availability'=>array(
                'normal'=>true,
                'dnd'=>false,
                'dnd_reason'=>__('DND delivery is not configured. Normal SMS will be used.', 'bulk-sms-portal')
            ),
            'funding'=>array(
                'bank_name'=>get_option('bsms_bank_name',''),
                'account_name'=>get_option('bsms_bank_account_name',''),
                'account_number'=>get_option('bsms_bank_account_number',''),
                'instructions'=>get_option('bsms_manual_funding_instructions',''),
                'paystack_public_key'=>get_option('bsms_paystack_public_key',''),
                'currency'=>strtoupper(sanitize_text_field(get_option('bsms_payment_currency','NGN'))),
                'minimum_amount'=>get_option('bsms_minimum_funding_amount','0'),
                'maximum_amount'=>get_option('bsms_maximum_funding_amount','0'),
                'quick_amounts'=>self::funding_limits()['quick_amounts'],
                'bank_accounts'=>self::portal_bank_accounts(),
                'gateways'=>self::portal_payment_gateways()
            ),
            'setup'=>array(
                'complete'=>false,
                'message'=>__('Complete setup to enable live sending, payment and pricing features.', 'bulk-sms-portal')
            ),
            'timezone'=>array(
                'name'=>wp_timezone_string() ?: 'UTC',
                'offset'=>wp_date('P'),
                'label'=>(wp_timezone_string() ?: 'UTC') . ' (' . wp_date('P') . ')'
            ),
            'dashboard_help'=>array(
                'title'=>__('Help & onboarding', 'bulk-sms-portal'),
                'html'=>''
            )
        );

        try {
            $wallet = BSMS_Wallet::get($uid);
            if ($wallet) $defaults['wallet'] = $wallet;
        } catch (Throwable $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) error_log('Bulk SMS Portal wallet load error: ' . $e->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Written only when WP_DEBUG is on.
        }

        try {
            $help_id = absint(get_option('bsms_dashboard_help_page_id', 0));
            if ($help_id) {
                $post = get_post($help_id);
                if ($post && in_array($post->post_status, array('publish','private'), true)) {
                    $defaults['dashboard_help'] = array(
                        'title' => get_the_title($post),
                        'html'  => wp_kses_post(apply_filters('the_content', $post->post_content)) // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core WordPress filter.
                    );
                }
            }
        } catch (Throwable $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) error_log('Bulk SMS Portal dashboard help load error: ' . $e->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Written only when WP_DEBUG is on.
        }

        try {
            $jobs = BSMS_DB::table('jobs');
            $ledger = BSMS_DB::table('ledger');
            $delivery = class_exists('BSMS_Providers') ? BSMS_Providers::delivery_summary($uid) : array();
            $sent = intval($delivery['total'] ?? 0);
            $success = intval($delivery['delivered'] ?? 0);
            $failed = intval($delivery['failed'] ?? 0);
            $pending = intval($delivery['pending'] ?? 0);
            $accepted = intval($delivery['accepted'] ?? 0);
            $delivery_rate = floatval($delivery['confirmed_delivery_rate'] ?? 0);
            $confirmed_rate = $delivery_rate;
            $defaults['sent'] = $sent;
            $defaults['delivery_rate'] = $delivery_rate;
            $defaults['delivery_metrics'] = array(
                'total' => $sent,
                'delivered' => $success,
                'success' => $success,
                'failed' => $failed,
                'pending' => $pending,
                'accepted' => $accepted,
                'successful' => intval($delivery['successful'] ?? ($accepted + $success)),
                'submitted' => intval($delivery['submitted'] ?? ($accepted + $pending + $success + $failed)),
                'successful_rate' => floatval($delivery['successful_rate'] ?? 0),
                'delivery_rate' => $delivery_rate,
                'confirmed_rate' => $confirmed_rate,
                'rate_label' => $sent ? (rtrim(rtrim(number_format_i18n($delivery_rate, 1), '0'), '.') . '%') : '0%',
                'rate_note' => $sent ? sprintf(/* translators: %1$d, %2$d: values filled in when shown */ __('%1$d successful · %2$d failed', 'bulk-sms-portal'), intval($delivery['successful'] ?? ($accepted + $success)), $failed) : __('No submitted messages yet', 'bulk-sms-portal'),
                'has_data' => $sent > 0,
                'has_final_dlr' => ($success + $failed) > 0,
            );
            $defaults['recent'] = self::safe_rows($jobs, 'user_id=%d', array($uid), 'id DESC', 5);
            // v3.5.0: customers only need the plain facts about a message. SMS
            // service replies and internal notes stay with platform admins.
            if (!self::can_manage_platform() && is_array($defaults['recent'])) {
                $keep = array('id','campaign_id','recipient','to_phone_e164','message','body','sender_id','route','status_bucket','cost_kobo','sent_at','delivered_at','updated_at');
                $defaults['recent'] = array_map(function($row) use ($keep){ $row = (array)$row; return array_intersect_key($row, array_flip($keep)); }, $defaults['recent']);
            }
            $defaults['transactions'] = self::safe_rows($ledger, 'user_id=%d', array($uid), 'id DESC', 5);
        } catch (Throwable $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) error_log('Bulk SMS Portal stats load error: ' . $e->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Written only when WP_DEBUG is on.
        }

        try {
            $defaults['units'] = BSMS_Wallet::estimated_units(intval($defaults['wallet']->sms_balance_kobo ?? 0));
        } catch (Throwable $e) {
            $defaults['units'] = 0;
            if (defined('WP_DEBUG') && WP_DEBUG) error_log('Bulk SMS Portal unit estimate error: ' . $e->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Written only when WP_DEBUG is on.
        }

        try {
            $sender_table = BSMS_DB::table('sender_ids');
            if (self::table_exists($sender_table)) {
                $approved = BSMS_Campaigns::approved_sender_ids($uid);
                $defaults['approved_senders'] = is_array($approved) ? $approved : array();
                if (!empty($defaults['approved_senders'])) $defaults['default_sender'] = $defaults['approved_senders'][0];
            }
        } catch (Throwable $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) error_log('Bulk SMS Portal sender list error: ' . $e->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Written only when WP_DEBUG is on.
        }

        try {
            $dnd_api_id = BSMS_Providers::service_for_route('dnd');
            $dnd_api = ($dnd_api_id > 0 && class_exists('BSMS_Providers')) ? BSMS_Providers::api_by_id($dnd_api_id) : null;
            $defaults['route_availability'] = array(
                'normal'=>true,
                'dnd'=>(bool)$dnd_api,
                'dnd_reason'=>$dnd_api
                    ? __('DND delivery is available.', 'bulk-sms-portal')
                    : __('DND delivery is currently unavailable — Normal SMS will be used.', 'bulk-sms-portal')
            );
        } catch (Throwable $e) {
            $defaults['route_availability']['dnd'] = false;
            $defaults['route_availability']['dnd_reason'] = __('DND delivery is currently unavailable — Normal SMS will be used.', 'bulk-sms-portal');
            if (defined('WP_DEBUG') && WP_DEBUG) error_log('Bulk SMS Portal route availability error: ' . $e->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Written only when WP_DEBUG is on.
        }


        return $defaults;
    }


    public static function paystack_init(WP_REST_Request $r){
        $secret = get_option('bsms_paystack_secret_key', '');
        if (!$secret) return new WP_REST_Response(array('ok'=>false,'error'=>__('Paystack is not configured.', 'bulk-sms-portal')), 400);

        $uid = get_current_user_id();
        $amount = BSMS_Util::kobo($r->get_param('amount_naira'));
        $amount_check = self::validate_funding_amount_kobo($amount);
        if (is_wp_error($amount_check)) return new WP_REST_Response(array('ok'=>false,'error'=>$amount_check->get_error_message()), 400);

        $user = wp_get_current_user();
        $reference = 'BSMS-' . $uid . '-' . time() . '-' . wp_generate_password(6,false,false);
        $payload = array(
            'email'=>$user->user_email,
            'amount'=>$amount,
            'reference'=>$reference,
            'currency'=>'NGN',
            'callback_url'=>BSMS_Util::payment_return_url('paystack', 'pending', $reference),
            'metadata'=>array(
                'user_id'=>$uid,
                'wallet'=>'sms',
                'portal_return'=>BSMS_Util::payment_return_url('paystack', 'pending', $reference),
                'success_url'=>BSMS_Util::payment_return_url('paystack', 'success', $reference),
                'failed_url'=>BSMS_Util::payment_return_url('paystack', 'failed', $reference)
            )
        );

        global $wpdb;
        $fr = BSMS_DB::table('funding_requests');
        $saved_request = $wpdb->insert($fr, array(
            'user_id'=>$uid,
            'amount_kobo'=>$amount,
            'method'=>'paystack',
            'status'=>BSMS_Funding::STATUS_AWAITING_PAYMENT,
            'reference'=>$reference,
            'meta_json'=>wp_json_encode(array('stage'=>'initialized','provider'=>'paystack')),
            'created_at'=>BSMS_Util::now_gmt(),
            'updated_at'=>BSMS_Util::now_gmt()
        ));
        if (!$saved_request) return new WP_REST_Response(array('ok'=>false,'error'=>__('Payment could not be started. Please try again.', 'bulk-sms-portal')), 503);

        $res = wp_remote_post('https://api.paystack.co/transaction/initialize', array(
            'headers'=>array('Authorization'=>'Bearer '.$secret, 'Content-Type'=>'application/json'),
            'body'=>wp_json_encode($payload),
            'timeout'=>30
        ));
        if (is_wp_error($res)) return new WP_REST_Response(array('ok'=>false,'error'=>$res->get_error_message()), 500);
        $body = json_decode(wp_remote_retrieve_body($res), true);
        if (empty($body['status'])) return new WP_REST_Response(array('ok'=>false,'error'=>__('Paystack init failed.', 'bulk-sms-portal')), 500);
        return array('ok'=>true, 'authorization_url'=>$body['data']['authorization_url'], 'reference'=>$reference, 'return_url'=>BSMS_Util::payment_return_url('paystack','pending',$reference), 'success_url'=>BSMS_Util::payment_return_url('paystack','success',$reference), 'failed_url'=>BSMS_Util::payment_return_url('paystack','failed',$reference));
    }

    
    public static function paystack_verify(WP_REST_Request $r){
        $reference = sanitize_text_field($r->get_param('reference'));
        $result = BSMS_Payments::confirm_paystack($reference, get_current_user_id());
        if (is_wp_error($result)) return new WP_REST_Response(array('ok'=>false,'error'=>$result->get_error_message()), intval(((array)$result->get_error_data())['status'] ?? 400));
        return $result;
    }

    public static function funding_proof_upload(WP_REST_Request $r){
        $uid = get_current_user_id();
        if (empty($_FILES['proof']) || !is_array($_FILES['proof'])) return new WP_REST_Response(array('ok'=>false,'error'=>__('Choose a receipt or payment proof to upload.', 'bulk-sms-portal')), 400); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- REST request; WordPress checks the REST nonce for signed-in users.
        $file = $_FILES['proof']; // phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Uploaded file is checked below (size, type and content) before it is stored.
        if (!empty($file['error']) || empty($file['tmp_name'])) return new WP_REST_Response(array('ok'=>false,'error'=>__('The payment proof could not be uploaded.', 'bulk-sms-portal')), 400);
        if (intval($file['size']) <= 0 || intval($file['size']) > 5 * 1024 * 1024) return new WP_REST_Response(array('ok'=>false,'error'=>__('Choose a file no larger than 5 MB.', 'bulk-sms-portal')), 400);
        $allowed = array('jpg|jpeg'=>'image/jpeg','png'=>'image/png','webp'=>'image/webp','pdf'=>'application/pdf');
        $checked = wp_check_filetype_and_ext($file['tmp_name'], $file['name'], $allowed);
        if (empty($checked['type']) || !in_array($checked['type'], array_values($allowed), true)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Choose a JPG, PNG, WebP or PDF file.', 'bulk-sms-portal')), 400);
        $id = BSMS_Private_Proofs::store($uid, $file['tmp_name'], $file['name'], $checked['type']);
        if (is_wp_error($id)) return new WP_REST_Response(array('ok'=>false,'error'=>$id->get_error_message()), 500);
        return array('ok'=>true,'attachment_id'=>intval($id),'filename'=>sanitize_file_name($file['name']));
    }

    public static function funding_proof_view(WP_REST_Request $r){
        global $wpdb;
        $id = absint($r['id']);
        $uid = get_current_user_id();
        $t = BSMS_DB::table('funding_requests');
        $row = $wpdb->get_row($wpdb->prepare("SELECT id,user_id,proof_attachment_id FROM {$wpdb->prefix}bsms_funding_requests WHERE id=%d", $id));
        if (!$row) return new WP_REST_Response(array('ok'=>false,'error'=>__('Payment request not found.', 'bulk-sms-portal')), 404);
        if (!self::can_manage_platform() && intval($row->user_id) !== $uid) return new WP_REST_Response(array('ok'=>false,'error'=>__('Access denied.', 'bulk-sms-portal')), 403);
        $proof = BSMS_Private_Proofs::row($row->proof_attachment_id);
        if (!$proof && intval($row->proof_attachment_id) > 0 && intval($row->proof_attachment_id) < BSMS_Private_Proofs::FIRST_PRIVATE_ID) {
            BSMS_Private_Proofs::migrate_existing();
            $proof = BSMS_Private_Proofs::row($row->proof_attachment_id);
        }
        if (!$proof || intval($proof->user_id) !== intval($row->user_id)) return new WP_REST_Response(array('ok'=>false,'error'=>__('This payment proof is unavailable. Please contact support.', 'bulk-sms-portal')), 404);
        if (intval($proof->request_id) && intval($proof->request_id) !== $id) return new WP_REST_Response(array('ok'=>false,'error'=>__('Access denied.', 'bulk-sms-portal')), 403);
        $bytes = base64_decode((string)$proof->data_base64, true);
        if ($bytes === false) return new WP_REST_Response(array('ok'=>false,'error'=>__('This payment proof could not be opened.', 'bulk-sms-portal')), 500);
        $mime = in_array($proof->mime, array('image/jpeg','image/png','image/webp','application/pdf'), true) ? $proof->mime : 'application/octet-stream';
        nocache_headers();
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . strlen($bytes));
        header('Content-Disposition: attachment; filename="' . str_replace('"','',basename($proof->filename)) . '"');
        header('X-Content-Type-Options: nosniff');
        header('Content-Security-Policy: sandbox');
        header('Referrer-Policy: no-referrer');
        echo $bytes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Binary file sent as a download (nosniff, sandboxed); escaping would corrupt it.
        exit;
    }

    public static function manual_funding(WP_REST_Request $r){
        $uid = get_current_user_id();
        $amount = BSMS_Util::kobo($r->get_param('amount_naira'));
        $amount_check = self::validate_funding_amount_kobo($amount);
        if (is_wp_error($amount_check)) return new WP_REST_Response(array('ok'=>false,'error'=>$amount_check->get_error_message()), 400);

        $reference = 'MANUAL-' . $uid . '-' . time() . '-' . wp_generate_password(5,false,false);
        $depositor = sanitize_text_field($r->get_param('depositor_name'));
        $bank = sanitize_text_field($r->get_param('bank_name'));
        $proof_attachment_id = max(0, intval($r->get_param('proof_attachment_id')));
        $note = sanitize_textarea_field($r->get_param('note'));
        if (!$proof_attachment_id) return new WP_REST_Response(array('ok'=>false,'error'=>__('Upload proof of payment before submitting this funding request.', 'bulk-sms-portal')), 400);
        $proof = BSMS_Private_Proofs::row($proof_attachment_id);
        if (!$proof || intval($proof->user_id) !== $uid || intval($proof->request_id) !== 0) {
            return new WP_REST_Response(array('ok'=>false,'error'=>__('The uploaded proof does not belong to this account.', 'bulk-sms-portal')), 403);
        }

        global $wpdb;
        $t = BSMS_DB::table('funding_requests');
        $ok = $wpdb->insert($t, array(
            'user_id'=>$uid,
            'amount_kobo'=>$amount,
            'method'=>'manual_transfer',
            'status'=>'pending',
            'reference'=>$reference,
            'depositor_name'=>$depositor,
            'bank_name'=>$bank,
            'proof_url'=>'',
            'proof_attachment_id'=>$proof_attachment_id,
            'meta_json'=>wp_json_encode(array('note'=>$note)),
            'created_at'=>BSMS_Util::now_gmt(),
            'updated_at'=>BSMS_Util::now_gmt()
        ));
        if (!$ok) return new WP_REST_Response(array('ok'=>false,'error'=>__('Funding request could not be saved.', 'bulk-sms-portal')), 500);
        $request_id = intval($wpdb->insert_id);
        $private_table = BSMS_DB::table('private_proofs');
        $claimed = $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}bsms_private_proofs SET request_id=%d WHERE id=%d AND user_id=%d AND request_id=0", $request_id, $proof_attachment_id, $uid));
        if ($claimed !== 1) {
            $wpdb->delete($t, array('id'=>$request_id,'user_id'=>$uid));
            return new WP_REST_Response(array('ok'=>false,'error'=>__('This payment proof was already used. Please upload it again.', 'bulk-sms-portal')), 409);
        }

        if (class_exists('BSMS_Notifications')) {
            BSMS_Notifications::admin_funding_submission($request_id, $uid, $amount, $reference, $depositor, $bank);
            BSMS_Notifications::notify($uid, 'funding', __('Funding request submitted', 'bulk-sms-portal'), sprintf(/* translators: %s: a value filled in when shown */ __('Your manual funding request has been submitted for admin approval. Reference: %s.', 'bulk-sms-portal'), $reference), array('reference'=>$reference,'funding_request_id'=>$request_id));
        }
        return array('ok'=>true, 'request_id'=>$request_id, 'reference'=>$reference, 'message'=>__('Funding request submitted with proof of payment for admin approval.', 'bulk-sms-portal'));
    }

    public static function funding_requests(?WP_REST_Request $r = null){
        global $wpdb;
        list($page, $per_page, $offset) = self::pagination_args($r, 20, 100);
        $t = BSMS_DB::table('funding_requests');
        $uid = get_current_user_id();
        $total = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_funding_requests WHERE user_id=%d", $uid)));
        $items = $wpdb->get_results($wpdb->prepare(
            "SELECT id, amount_kobo, method, status, reference, depositor_name, bank_name, proof_attachment_id, admin_note, created_at, updated_at FROM {$wpdb->prefix}bsms_funding_requests WHERE user_id=%d ORDER BY id DESC LIMIT %d OFFSET %d",
            $uid, $per_page, $offset
        ), ARRAY_A);
        return self::paginated_response($items, $total, $page, $per_page);
    }




    public static function campaign_status(WP_REST_Request $r){
        $uid = get_current_user_id();
        $campaign_id = intval($r['id']);
        global $wpdb;
        $c = BSMS_DB::table('campaigns');
        $j = BSMS_DB::table('jobs');

        $campaign = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}bsms_campaigns WHERE id=%d AND user_id=%d",
            $campaign_id, $uid
        ), ARRAY_A);

        if (!$campaign && self::can_manage_platform()) {
            $campaign = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_campaigns WHERE id=%d", $campaign_id), ARRAY_A);
        }

        if (!$campaign) return new WP_REST_Response(array('ok'=>false,'error'=>__('Campaign not found.', 'bulk-sms-portal')), 404);

        if (self::can_manage_platform()) {
            $origin = get_user_by('id', intval($campaign['user_id']));
            $campaign['user_name'] = $origin ? $origin->display_name : (sprintf(/* translators: %s: a value filled in when shown */ __('User #%s', 'bulk-sms-portal'), intval($campaign['user_id'])));
            $campaign['user_email'] = $origin ? $origin->user_email : '';
        }

        $where_user = self::can_manage_platform() ? '' : $wpdb->prepare(" AND user_id=%d", $uid);
        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $where_user is empty or prepared on the line above.
        $summary = $wpdb->get_row($wpdb->prepare(
            "SELECT COUNT(*) total,
                    SUM(status_bucket='queued') queued,
                    SUM(status_bucket='pending') pending,
                    SUM(status_bucket='sent') sent,
                    SUM(status_bucket='success') success,
                    SUM(status_bucket='failed') failed,
                    SUM(status_bucket='skipped') skipped,
                    SUM(cost_kobo) reserved_cost,
                    SUM(CASE WHEN status_bucket IN('pending','sent','success') THEN cost_kobo ELSE 0 END) charged_cost
             FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d $where_user",
            $campaign_id
        ), ARRAY_A);

        $status_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT status_bucket, provider_status, err_code, api_id, sent_at FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d $where_user",
            $campaign_id
        ), ARRAY_A);
        $canonical = array('queued'=>0,'pending'=>0,'accepted'=>0,'delivered'=>0,'successful'=>0,'failed'=>0,'skipped'=>0);
        foreach ((array)$status_rows as $status_row) {
            $status = class_exists('BSMS_Providers') ? BSMS_Providers::canonical_job_status($status_row) : strtolower((string)$status_row['status_bucket']);
            if (isset($canonical[$status])) $canonical[$status]++;
            if (in_array($status, array('accepted','delivered'), true)) $canonical['successful']++;
        }

        $recent = $wpdb->get_results($wpdb->prepare(
            "SELECT to_phone_e164, recipient, provider_status, status_bucket, last_error, sent_at, delivered_at
             FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d $where_user ORDER BY id DESC LIMIT 10",
            $campaign_id
        ), ARRAY_A);
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        return array(
            'ok'=>true,
            'campaign'=>array(
                'id'=>intval($campaign['id']),
                'name'=>$campaign['name'],
                'status'=>$campaign['status'],
                'sender_id'=>$campaign['sender_id'],
                'route'=>$campaign['route'],
                'created_at'=>$campaign['created_at'],
                'schedule_at'=>$campaign['schedule_at']
            ),
            'summary'=>array(
                'total'=>intval($summary['total'] ?? 0),
                'queued'=>$canonical['queued'],
                'pending'=>$canonical['pending'],
                'accepted'=>$canonical['accepted'],
                'sent'=>$canonical['accepted'],
                'delivered'=>$canonical['delivered'],
                'success'=>$canonical['delivered'],
                'successful'=>$canonical['successful'],
                'failed'=>$canonical['failed'],
                'skipped'=>$canonical['skipped'],
                'cost_kobo'=>intval($summary['charged_cost'] ?? 0),
                'reserved_cost_kobo'=>intval($summary['reserved_cost'] ?? 0)
            ),
            'recent'=>$recent
        );
    }

    public static function campaign_estimate(WP_REST_Request $r){
        if ($r->get_param('schedule_at') && class_exists('BSMS_Entitlements') && !BSMS_Entitlements::is_enabled('scheduled_sms',get_current_user_id())) {
            return new WP_REST_Response(array('ok'=>false,'code'=>'bsms_feature_unavailable','feature'=>'scheduled_sms','error'=>__('Scheduled SMS is not available for your account.', 'bulk-sms-portal')),403);
        }
        $uid = get_current_user_id();
        $numbers = BSMS_Util::parse_numbers($r->get_param('numbers') . "\n" . $r->get_param('csv_numbers'));

        if ($r->get_param('group_id')) {
            global $wpdb;
            $gt = BSMS_DB::table('phone_group_numbers');
            $group_numbers = $wpdb->get_col($wpdb->prepare(
                "SELECT phone_e164 FROM {$wpdb->prefix}bsms_phone_group_numbers WHERE group_id=%d AND user_id=%d",
                intval($r->get_param('group_id')), $uid
            ));
            $numbers = array_merge($numbers, $group_numbers);
        }

        $cc = BSMS_Util::default_country($uid);
        $clean = array();
        $invalid = 0;
        foreach ($numbers as $raw) {
            $p = BSMS_Util::normalize_phone_e164($raw, $cc);
            if ($p) $clean[] = $p; else $invalid++;
        }
        $submitted = count($numbers);
        $before = count($clean);
        $clean = array_values(array_unique($clean));
        $duplicates = $before - count($clean);
        if (class_exists('BSMS_Entitlements')) {
            $gate=BSMS_Entitlements::enforce_limit('recipients_per_campaign',count($clean),$uid,array('recipients'=>count($clean)),true);
            if (is_wp_error($gate)) return new WP_REST_Response(array('ok'=>false,'can_send'=>false,'code'=>$gate->get_error_code(),'error'=>$gate->get_error_message())+(array)$gate->get_error_data(),403);
        }

        $breakdown = BSMS_Pricing::price_breakdown($clean, (string)$r->get_param('message'), BSMS_Providers::normalise_route($r->get_param('route')), $uid);
        $reserved = BSMS_Wallet::reserved_kobo($uid);
        $available = BSMS_Wallet::get_balance_kobo($uid) - $reserved;
        $no_rate = count((array)($breakdown['no_rate'] ?? array()));
        $no_service = count(array_filter((array)($breakdown['no_rate_reasons'] ?? array()), function($x){ return $x === 'no_service'; }));
        // v3.6.2: what each group of numbers costs, by country and network.
        $lines = array();
        foreach ((array)$breakdown['rows'] as $row) {
            if (!empty($row['no_rate'])) continue;
            $label = BSMS_Pricing::country_name($row['country']) . (($row['network'] ?? 'all') !== 'all' && $row['network'] !== '' ? ' · ' . $row['network'] : '') . (!empty($row['special']) ? sprintf(/* translators: %s: a value filled in when shown */ __(' (numbers starting %s)', 'bulk-sms-portal'), $row['special']) : '');
            $k = $label . '|' . intval($row['unit_price_kobo']);
            if (!isset($lines[$k])) $lines[$k] = array('label'=>$label, 'unit_kobo'=>intval($row['unit_price_kobo']), 'people'=>0, 'total_kobo'=>0);
            $lines[$k]['people']++; $lines[$k]['total_kobo'] += intval($row['cost_kobo']);
        }
        usort($lines, function($a, $b){ return $b['people'] <=> $a['people']; });

        $required = intval($breakdown['total_kobo']);
        $shortfall = max(0, $required - intval($available));
        $priced_numbers = array_values(array_diff($clean, (array)($breakdown['no_rate'] ?? array())));
        $ready = !$priced_numbers || BSMS_Providers::ready_for($priced_numbers, BSMS_Providers::normalise_route($r->get_param('route')), $uid);
        return array(
            'ok'=>true,
            'submitted'=>$submitted,
            'valid'=>count($clean) - $no_rate,
            'no_rate'=>$no_rate,
            'no_rate_numbers'=>array_slice((array)($breakdown['no_rate'] ?? array()), 0, 10),
            'no_service'=>$no_service,
            'lines'=>array_slice(array_values($lines), 0, 12),
            'reserved_kobo'=>intval($reserved),
            'invalid'=>$invalid,
            'duplicates'=>$duplicates,
            'pages'=>$breakdown['pages'],
            'total_kobo'=>$required,
            'required_kobo'=>$required,
            'balance_kobo'=>intval($available),
            'balance_after_kobo'=>intval($available) - $required,
            'shortfall_kobo'=>$shortfall,
            'can_send'=>($ready && $required > 0 && intval($available) >= $required),
            'sending_ready'=>$ready,
            'purchase_url'=>BSMS_Util::portal_url(array(), 'fund'),
            'sample'=>array_slice($breakdown['rows'], 0, 20)
        );
    }

    public static function campaign_send(WP_REST_Request $r){
        if ($r->get_param('schedule_at') && class_exists('BSMS_Entitlements') && !BSMS_Entitlements::is_enabled('scheduled_sms',get_current_user_id())) {
            return new WP_REST_Response(array('ok'=>false,'code'=>'bsms_feature_unavailable','feature'=>'scheduled_sms','error'=>__('Scheduled SMS is not available for your account.', 'bulk-sms-portal')),403);
        }
        if (!self::can_send_sms()) return self::forbidden(__('You are not permitted to send SMS.', 'bulk-sms-portal'));
        try {
        $uid = get_current_user_id();
        $message = trim((string)$r->get_param('message'));
        if ($message === '') return new WP_REST_Response(array('ok'=>false,'error'=>__('Message cannot be empty.', 'bulk-sms-portal')), 400);
        $numbers = BSMS_Util::parse_numbers($r->get_param('numbers') . "\n" . $r->get_param('csv_numbers'));

        if ($r->get_param('group_id')) {
            global $wpdb;
            $gt = BSMS_DB::table('phone_group_numbers');
            $group_numbers = $wpdb->get_col($wpdb->prepare(
                "SELECT phone_e164 FROM {$wpdb->prefix}bsms_phone_group_numbers WHERE group_id=%d AND user_id=%d",
                intval($r->get_param('group_id')), $uid
            ));
            $numbers = array_merge($numbers, $group_numbers);
        }

        if (class_exists('BSMS_Entitlements')) {
            $recipient_gate=BSMS_Entitlements::enforce_limit('recipients_per_campaign',count(array_unique($numbers)),$uid,array('recipients'=>count(array_unique($numbers))),true);
            if (is_wp_error($recipient_gate)) return new WP_REST_Response(array('ok'=>false,'code'=>$recipient_gate->get_error_code(),'error'=>$recipient_gate->get_error_message())+(array)$recipient_gate->get_error_data(),403);
            $daily_gate=BSMS_Entitlements::enforce_limit('campaigns_per_day',1,$uid);
            if (is_wp_error($daily_gate)) return new WP_REST_Response(array('ok'=>false,'code'=>$daily_gate->get_error_code(),'error'=>$daily_gate->get_error_message())+(array)$daily_gate->get_error_data(),403);
        }

        $schedule = null;
        if ($r->get_param('schedule_at')) {
            try {
                $dt = new DateTime($r->get_param('schedule_at'), wp_timezone());
                $dt->setTimezone(new DateTimeZone('UTC'));
                $schedule = $dt->format('Y-m-d H:i:s');
            } catch (Exception $e) {}
        }

        $res = BSMS_Campaigns::create(
            $uid,
            $r->get_param('name') ?: __('SMS Campaign', 'bulk-sms-portal'),
            $message,
            $numbers,
            $r->get_param('sender_id'),
            BSMS_Providers::normalise_route($r->get_param('route')),
            $schedule,
            true
        );

        if (is_wp_error($res)) return new WP_REST_Response(array('ok'=>false,'error'=>$res->get_error_message()), 400);

        // Never block the browser request on an upstream SMS gateway.
        // Record the campaign first, return immediately, and let the queue worker
        // perform provider delivery asynchronously.
        if (empty($schedule) && class_exists('BSMS_Cron')) {
            wp_schedule_single_event(time() + 1, BSMS_Cron::HOOK);
            if (function_exists('spawn_cron')) {
                spawn_cron(time());
            }
        }

        return array(
            'ok'=>true,
            'accepted'=>true,
            'processing'=>empty($schedule),
            'message'=>empty($schedule) ? __('Campaign recorded and queued for sending.', 'bulk-sms-portal') : __('Campaign scheduled successfully.', 'bulk-sms-portal')
        ) + $res;
    
        } catch (Throwable $e) {
            if (class_exists('BSMS_Security')) {
                BSMS_Security::log(
                    'campaign_send_exception',
                    'Campaign send exception',
                    array('message'=>$e->getMessage()),
                    'campaign',
                    0,
                    get_current_user_id()
                );
            }
            return new WP_REST_Response(array(
                'ok'=>false,
                'error'=>__('SMS submission failed before the campaign could be created. Please try again.', 'bulk-sms-portal'),
                'code'=>'bsms_send_exception'
            ), 500);
        }
    }

    public static function groups(){
        global $wpdb;
        $uid = get_current_user_id();
        $g = BSMS_DB::table('phone_groups');
        $n = BSMS_DB::table('phone_group_numbers');
        $items = $wpdb->get_results($wpdb->prepare(
            "SELECT g.*, (SELECT COUNT(*) FROM {$wpdb->prefix}bsms_phone_group_numbers WHERE group_id=g.id) total FROM {$wpdb->prefix}bsms_phone_groups g WHERE user_id=%d ORDER BY id DESC",
            $uid
        ), ARRAY_A);
        return array('ok'=>true, 'items'=>$items);
    }

    public static function create_group(WP_REST_Request $r){
        if (class_exists('BSMS_Entitlements')) {
            $gate=BSMS_Entitlements::enforce_limit('phone_groups',1,get_current_user_id());
            if (is_wp_error($gate)) return new WP_REST_Response(array('ok'=>false,'code'=>$gate->get_error_code(),'error'=>$gate->get_error_message())+(array)$gate->get_error_data(),403);
        }
        global $wpdb;
        $uid = get_current_user_id();
        $name = sanitize_text_field($r->get_param('group_name') ?: $r->get_param('name'));
        if (!$name) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group name is required.', 'bulk-sms-portal')), 400);

        $g = BSMS_DB::table('phone_groups');
        $n = BSMS_DB::table('phone_group_numbers');
        $wpdb->insert($g, array('user_id'=>$uid, 'group_name'=>$name, 'created_at'=>BSMS_Util::now_gmt()));
        $gid = $wpdb->insert_id;

        $cc = BSMS_Util::default_country($uid);
        $valid = 0; $invalid = 0; $duplicates = 0; $seen = array();
        foreach (BSMS_Util::parse_numbers($r->get_param('numbers')) as $raw) {
            $phone = BSMS_Util::normalize_phone_e164($raw, $cc);
            if (!$phone) { $invalid++; continue; }
            if (isset($seen[$phone])) { $duplicates++; continue; }
            $seen[$phone] = true;
            $ins = $wpdb->insert($n, array(
                'group_id'=>$gid, 'user_id'=>$uid, 'phone_e164'=>$phone, 'raw_phone'=>$raw, 'created_at'=>BSMS_Util::now_gmt()
            ));
            if ($ins) $valid++; else $duplicates++;
        }
        return array('ok'=>true, 'group_id'=>$gid, 'valid'=>$valid, 'invalid'=>$invalid, 'duplicates'=>$duplicates);
    }



    private static function user_group_row($group_id, $user_id){
        global $wpdb;
        $g = BSMS_DB::table('phone_groups');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_phone_groups WHERE id=%d AND user_id=%d", intval($group_id), intval($user_id)));
    }

    private static function insert_group_numbers($group_id, $user_id, $numbers, $replace=false){
        global $wpdb;
        $n = BSMS_DB::table('phone_group_numbers');
        if ($replace) $wpdb->delete($n, array('group_id'=>intval($group_id), 'user_id'=>intval($user_id)));

        $cc = BSMS_Util::default_country($user_id);
        $valid = 0; $invalid = 0; $duplicates = 0; $seen = array();

        foreach ($numbers as $raw) {
            $phone = BSMS_Util::normalize_phone_e164($raw, $cc);
            if (!$phone) { $invalid++; continue; }
            if (isset($seen[$phone])) { $duplicates++; continue; }
            $seen[$phone] = true;
            $ins = $wpdb->insert($n, array(
                'group_id'=>intval($group_id),
                'user_id'=>intval($user_id),
                'phone_e164'=>$phone,
                'raw_phone'=>$raw,
                'created_at'=>BSMS_Util::now_gmt()
            ));
            if ($ins) $valid++; else $duplicates++;
        }

        return array('valid'=>$valid,'invalid'=>$invalid,'duplicates'=>$duplicates);
    }

    public static function group_detail(WP_REST_Request $r){
        $uid = get_current_user_id();
        $group_id = intval($r['id']);
        $group = self::user_group_row($group_id, $uid);
        if (!$group) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group not found.', 'bulk-sms-portal')), 404);

        global $wpdb;
        $n = BSMS_DB::table('phone_group_numbers');
        $numbers = $wpdb->get_results($wpdb->prepare(
            "SELECT id, phone_e164, raw_phone, created_at FROM {$wpdb->prefix}bsms_phone_group_numbers WHERE group_id=%d AND user_id=%d ORDER BY id DESC LIMIT 2000",
            $group_id, $uid
        ), ARRAY_A);

        return array('ok'=>true,'group'=>$group,'numbers'=>$numbers);
    }

    public static function group_rename(WP_REST_Request $r){
        $uid = get_current_user_id();
        $group_id = intval($r['id']);
        $group = self::user_group_row($group_id, $uid);
        if (!$group) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group not found.', 'bulk-sms-portal')), 404);

        $name = sanitize_text_field($r->get_param('group_name') ?: $r->get_param('name'));
        if (!$name) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group name is required.', 'bulk-sms-portal')), 400);

        global $wpdb;
        $g = BSMS_DB::table('phone_groups');
        $wpdb->update($g, array('group_name'=>$name), array('id'=>$group_id,'user_id'=>$uid));
        return array('ok'=>true);
    }

    public static function group_add_numbers(WP_REST_Request $r){
        $uid = get_current_user_id();
        $group_id = intval($r['id']);
        if (!self::user_group_row($group_id, $uid)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group not found.', 'bulk-sms-portal')), 404);

        $numbers = BSMS_Util::parse_numbers($r->get_param('numbers'));
        if (empty($numbers)) return new WP_REST_Response(array('ok'=>false,'error'=>__('No numbers provided.', 'bulk-sms-portal')), 400);

        if (class_exists('BSMS_Entitlements')) {
            $gate=BSMS_Entitlements::enforce_limit('contacts_per_group',count($numbers),$uid,array('group_id'=>$group_id),false);
            if (is_wp_error($gate)) return new WP_REST_Response(array('ok'=>false,'code'=>$gate->get_error_code(),'error'=>$gate->get_error_message())+(array)$gate->get_error_data(),403);
        }

        return array('ok'=>true) + self::insert_group_numbers($group_id, $uid, $numbers, false);
    }

    public static function group_delete_number(WP_REST_Request $r){
        $uid = get_current_user_id();
        $group_id = intval($r['id']);
        $number_id = intval($r['number_id']);
        if (!self::user_group_row($group_id, $uid)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group not found.', 'bulk-sms-portal')), 404);

        global $wpdb;
        $n = BSMS_DB::table('phone_group_numbers');
        $wpdb->delete($n, array('id'=>$number_id, 'group_id'=>$group_id, 'user_id'=>$uid));
        return array('ok'=>true);
    }

    public static function group_replace_numbers(WP_REST_Request $r){
        $uid = get_current_user_id();
        $group_id = intval($r['id']);
        if (!self::user_group_row($group_id, $uid)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group not found.', 'bulk-sms-portal')), 404);

        $numbers = BSMS_Util::parse_numbers($r->get_param('numbers'));
        if (empty($numbers)) return new WP_REST_Response(array('ok'=>false,'error'=>__('No numbers provided.', 'bulk-sms-portal')), 400);

        if (class_exists('BSMS_Entitlements')) {
            $gate=BSMS_Entitlements::enforce_limit('contacts_per_group',count($numbers),$uid,array('group_id'=>$group_id),true);
            if (is_wp_error($gate)) return new WP_REST_Response(array('ok'=>false,'code'=>$gate->get_error_code(),'error'=>$gate->get_error_message())+(array)$gate->get_error_data(),403);
        }

        return array('ok'=>true) + self::insert_group_numbers($group_id, $uid, $numbers, true);
    }

    public static function group_append_csv(WP_REST_Request $r){
        $uid = get_current_user_id();
        $group_id = intval($r['id']);
        if (!self::user_group_row($group_id, $uid)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group not found.', 'bulk-sms-portal')), 404);

        $csv_text = (string)$r->get_param('csv');
        $files = $r->get_file_params();
        if (!$csv_text && !empty($files['file']['tmp_name']) && is_uploaded_file($files['file']['tmp_name'])) {
            $csv_text = file_get_contents($files['file']['tmp_name']);
        }
        $numbers = BSMS_Util::parse_csv_numbers($csv_text);
        if (empty($numbers)) return new WP_REST_Response(array('ok'=>false,'error'=>__('No phone numbers found in CSV.', 'bulk-sms-portal')), 400);

        if (class_exists('BSMS_Entitlements')) {
            $gate=BSMS_Entitlements::enforce_limit('contacts_per_group',count($numbers),$uid,array('group_id'=>$group_id),false);
            if (is_wp_error($gate)) return new WP_REST_Response(array('ok'=>false,'code'=>$gate->get_error_code(),'error'=>$gate->get_error_message())+(array)$gate->get_error_data(),403);
        }

        return array('ok'=>true) + self::insert_group_numbers($group_id, $uid, $numbers, false);
    }

    public static function group_delete(WP_REST_Request $r){
        $uid = get_current_user_id();
        $group_id = intval($r['id']);
        if (!self::user_group_row($group_id, $uid)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group not found.', 'bulk-sms-portal')), 404);

        global $wpdb;
        $g = BSMS_DB::table('phone_groups');
        $n = BSMS_DB::table('phone_group_numbers');
        $wpdb->delete($n, array('group_id'=>$group_id,'user_id'=>$uid));
        $wpdb->delete($g, array('id'=>$group_id,'user_id'=>$uid));
        return array('ok'=>true);
    }

    public static function import_group_csv(WP_REST_Request $r){
        $uid = get_current_user_id();
        $group_name = sanitize_text_field($r->get_param('group_name') ?: $r->get_param('name'));
        if (!$group_name) return new WP_REST_Response(array('ok'=>false,'error'=>__('Group name is required.', 'bulk-sms-portal')), 400);

        $csv_text = (string)$r->get_param('csv');
        $files = $r->get_file_params();
        if (!$csv_text && !empty($files['file']['tmp_name']) && is_uploaded_file($files['file']['tmp_name'])) {
            $csv_text = file_get_contents($files['file']['tmp_name']);
        }
        if (!$csv_text) return new WP_REST_Response(array('ok'=>false,'error'=>__('CSV content is required.', 'bulk-sms-portal')), 400);

        $numbers = BSMS_Util::parse_csv_numbers($csv_text);
        if (empty($numbers)) return new WP_REST_Response(array('ok'=>false,'error'=>__('No phone numbers found in CSV.', 'bulk-sms-portal')), 400);

        $request = new WP_REST_Request('POST');
        $request->set_param('group_name', $group_name);
        $request->set_param('numbers', implode("\n", $numbers));
        return self::create_group($request);
    }


    public static function reports_export(){
        global $wpdb;
        $uid = get_current_user_id();
        $admin = self::can_manage_platform();
        $c = BSMS_DB::table('campaigns');
        $j = BSMS_DB::table('jobs');

        if ($admin) {
            $rows = $wpdb->get_results(
                "SELECT c.id campaign_id, c.user_id, u.display_name user_name, u.user_email user_email,
                        c.name campaign_name, c.sender_id, c.route, c.status campaign_status, c.created_at campaign_date,
                        j.to_phone_e164 phone, j.api_id, j.provider_status, j.status_bucket, j.err_code, j.sent_at, j.delivered_at, j.cost_kobo
                 FROM {$wpdb->prefix}bsms_campaigns c
                 LEFT JOIN {$wpdb->users} u ON u.ID=c.user_id
                 LEFT JOIN {$wpdb->prefix}bsms_jobs j ON c.id=j.campaign_id AND j.user_id=c.user_id
                 ORDER BY c.id DESC, j.id ASC LIMIT 10000",
                ARRAY_A
            );
        } else {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT c.id campaign_id, c.name campaign_name, c.sender_id, c.status campaign_status, c.created_at campaign_date,
                        j.to_phone_e164 phone, j.api_id, j.provider_status, j.status_bucket, j.err_code, j.sent_at, j.delivered_at, j.cost_kobo
                 FROM {$wpdb->prefix}bsms_campaigns c
                 LEFT JOIN {$wpdb->prefix}bsms_jobs j ON c.id=j.campaign_id AND j.user_id=c.user_id
                 WHERE c.user_id=%d
                 ORDER BY c.id DESC, j.id ASC LIMIT 10000",
                $uid
            ), ARRAY_A);
        }

        foreach ($rows as &$row) {
            $canonical = class_exists('BSMS_Providers') ? BSMS_Providers::canonical_job_status($row) : strtolower((string)($row['status_bucket'] ?? 'pending'));
            $row['status_bucket'] = $canonical === 'failed' ? 'failed' : (in_array($canonical, array('accepted','delivered'), true) ? 'successful' : 'sending');
            $row['campaign_status'] = $row['status_bucket'];
            unset($row['provider_status']);
            $row['cost_naira'] = BSMS_Util::naira_from_kobo($row['cost_kobo']);
            unset($row['api_id'], $row['err_code']);
        }
        unset($row);

        $columns = $admin
            ? array('campaign_id','user_id','user_name','user_email','campaign_name','sender_id','route','campaign_status','campaign_date','phone','status_bucket','sent_at','cost_naira')
            : array('campaign_id','campaign_name','sender_id','campaign_status','campaign_date','phone','status_bucket','sent_at','delivered_at','cost_naira');

        return BSMS_Util::csv_download_response(
            ($admin ? 'platform-sms-reports-' : 'sms-reports-') . gmdate('Ymd-His') . '.csv',
            $rows,
            $columns
        );
    }




    public static function templates(){
        global $wpdb;
        $t = BSMS_DB::table('templates');
        $items = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_templates WHERE user_id=%d ORDER BY id DESC", get_current_user_id()), ARRAY_A);
        return array('ok'=>true,'items'=>$items);
    }

    public static function save_template(WP_REST_Request $r){
        if (class_exists('BSMS_Entitlements')) {
            $gate=BSMS_Entitlements::enforce_limit('templates',1,get_current_user_id());
            if (is_wp_error($gate)) return new WP_REST_Response(array('ok'=>false,'code'=>$gate->get_error_code(),'error'=>$gate->get_error_message())+(array)$gate->get_error_data(),403);
        }
        global $wpdb;
        $t = BSMS_DB::table('templates');
        $wpdb->insert($t, array(
            'user_id'=>get_current_user_id(),
            'title'=>sanitize_text_field($r->get_param('title')),
            'category'=>sanitize_text_field($r->get_param('category') ?: 'custom'),
            'body'=>$r->get_param('body'),
            'created_at'=>BSMS_Util::now_gmt()
        ));
        return array('ok'=>true);
    }

    public static function sender_ids(){
        global $wpdb;
        $t = BSMS_DB::table('sender_ids');
        $uid = get_current_user_id();
        $items = $wpdb->get_results($wpdb->prepare("SELECT id, sender_id, sample_message, status, admin_note, created_at, updated_at FROM {$wpdb->prefix}bsms_sender_ids WHERE user_id=%d ORDER BY id DESC", $uid), ARRAY_A);
        // v3.5.0: show the customer why a name was not approved, in plain words.
        foreach ($items as &$item) {
            $note = trim((string)($item['admin_note'] ?? ''));
            if ($note !== '' && preg_match('/Reason:\s*(.+)$/is', $note, $m)) $note = trim($m[1]);
            $item['reason'] = ($item['status'] === 'rejected') ? $note : '';
            unset($item['admin_note']);
        }
        unset($item);
        $approved = array_values(array_map(function($r){ return $r['sender_id']; }, array_filter($items, function($r){ return $r['status']==='approved'; })));
        return array(
            'ok'=>true,
            'default_sender'=>BSMS_Campaigns::default_sender($uid),
            'approved'=>$approved,
            'items'=>$items
        );
    }

    public static function apply_sender(WP_REST_Request $r){
        if (class_exists('BSMS_Entitlements')) {
            $gate=BSMS_Entitlements::enforce_limit('sender_ids',1,get_current_user_id());
            if (is_wp_error($gate)) return new WP_REST_Response(array('ok'=>false,'code'=>$gate->get_error_code(),'error'=>$gate->get_error_message())+(array)$gate->get_error_data(),403);
        }
        $sender = BSMS_Util::validate_sender_id($r->get_param('sender_id'));
        if (!$sender) return new WP_REST_Response(array('ok'=>false,'error'=>__('Sender ID must be 1-11 valid characters.', 'bulk-sms-portal')), 400);
        $sample = sanitize_textarea_field($r->get_param('sample_message'));
        if (!$sample) return new WP_REST_Response(array('ok'=>false,'error'=>__('Sample message is required before Sender ID approval.', 'bulk-sms-portal')), 400);
        global $wpdb;
        $t = BSMS_DB::table('sender_ids');
        $uid = get_current_user_id();
        // v3.5.0: one request per name. Asking again while a name is waiting
        // or already approved only adds work for the reviewer.
        $existing = $wpdb->get_var($wpdb->prepare("SELECT status FROM {$wpdb->prefix}bsms_sender_ids WHERE user_id=%d AND UPPER(sender_id)=UPPER(%s) AND status IN ('pending','approved') ORDER BY id DESC LIMIT 1", $uid, $sender));
        if ($existing === 'approved') return new WP_REST_Response(array('ok'=>false,'code'=>'bsms_sender_exists','error'=>__('This name is already approved on your account. You can use it now.', 'bulk-sms-portal')), 409);
        if ($existing === 'pending') return new WP_REST_Response(array('ok'=>false,'code'=>'bsms_sender_pending','error'=>__('You have already asked for this name. We will let you know when it has been checked.', 'bulk-sms-portal')), 409);
        $wpdb->insert($t, array(
            'user_id'=>$uid,
            'sender_id'=>$sender,
            'sample_message'=>$sample,
            'status'=>'pending',
            'created_at'=>BSMS_Util::now_gmt(),
            'updated_at'=>BSMS_Util::now_gmt()
        ));
        $request_id = intval($wpdb->insert_id);
        if ($request_id > 0 && class_exists('BSMS_Notifications')) {
            BSMS_Notifications::admin_sender_submission($request_id, $uid, $sender, $sample);
        }
        return array('ok'=>true,'request_id'=>$request_id,'message'=>__('Sender ID request submitted. The administrator has been notified.', 'bulk-sms-portal'));
    }
    public static function reports(?WP_REST_Request $r = null){
        global $wpdb;
        $uid = get_current_user_id();
        $admin = self::can_manage_platform();
        list($page, $per_page, $offset) = self::pagination_args($r, 20, 50);
        $c = BSMS_DB::table('campaigns');
        $j = BSMS_DB::table('jobs');
        $l = BSMS_DB::table('ledger');

        $select = "SELECT c.*, COUNT(j.id) job_total,
                SUM(CASE WHEN j.status_bucket='success' THEN 1 ELSE 0 END) success_count,
                SUM(CASE WHEN j.status_bucket='sent' THEN 1 ELSE 0 END) sent_count,
                SUM(CASE WHEN j.status_bucket='failed' THEN 1 ELSE 0 END) failed_count,
                SUM(CASE WHEN j.status_bucket='pending' THEN 1 ELSE 0 END) pending_count,
                SUM(CASE WHEN j.status_bucket='queued' THEN 1 ELSE 0 END) queued_count,
                SUM(CASE WHEN j.status_bucket='skipped' THEN 1 ELSE 0 END) skipped_count,
                SUM(CASE WHEN j.err_code='DUPLICATE' THEN 1 ELSE 0 END) duplicate_count,
                SUM(CASE WHEN j.err_code='INVALID_NUMBER' THEN 1 ELSE 0 END) invalid_count,
                COALESCE(SUM(-lc.amount_kobo),0) charged_kobo,
                COALESCE(SUM(lr.amount_kobo),0) refunded_kobo,
                SUM(j.cost_kobo) total_cost_kobo";

        if ($admin) {
            $total = intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_campaigns"));
            $items = $wpdb->get_results($wpdb->prepare(
                // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $select is a fixed SQL string defined in this function.
                $select . ", u.display_name AS user_name, u.user_email AS user_email
                 FROM {$wpdb->prefix}bsms_campaigns c
                 LEFT JOIN {$wpdb->users} u ON u.ID=c.user_id
                 LEFT JOIN {$wpdb->prefix}bsms_jobs j ON c.id=j.campaign_id AND j.user_id=c.user_id
                 LEFT JOIN {$wpdb->prefix}bsms_ledger lc ON lc.reference=CONCAT('JOB-',j.id) AND lc.type='sms_charge' AND lc.user_id=j.user_id
                 LEFT JOIN {$wpdb->prefix}bsms_ledger lr ON lr.reference=CONCAT('REFUND-JOB-',j.id) AND lr.amount_kobo>0 AND lr.user_id=j.user_id
                 GROUP BY c.id ORDER BY c.id DESC LIMIT %d OFFSET %d",
                $per_page, $offset
            ), ARRAY_A);
        } else {
            $total = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_campaigns WHERE user_id=%d", $uid)));
            $items = $wpdb->get_results($wpdb->prepare(
                // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $select is a fixed SQL string defined in this function.
                $select . "
                 FROM {$wpdb->prefix}bsms_campaigns c
                 LEFT JOIN {$wpdb->prefix}bsms_jobs j ON c.id=j.campaign_id AND j.user_id=c.user_id
                 LEFT JOIN {$wpdb->prefix}bsms_ledger lc ON lc.reference=CONCAT('JOB-',j.id) AND lc.type='sms_charge' AND lc.user_id=j.user_id
                 LEFT JOIN {$wpdb->prefix}bsms_ledger lr ON lr.reference=CONCAT('REFUND-JOB-',j.id) AND lr.amount_kobo>0 AND lr.user_id=j.user_id
                 WHERE c.user_id=%d
                 GROUP BY c.id ORDER BY c.id DESC LIMIT %d OFFSET %d",
                $uid, $per_page, $offset
            ), ARRAY_A);
        }

        $canonical_counts = self::canonical_campaign_counts(array_column((array)$items, 'id'));
        foreach ($items as &$item) {
            $cid = intval($item['id']);
            if (isset($canonical_counts[$cid])) {
                $item['job_total'] = $canonical_counts[$cid]['job_total'];
                $item['success_count'] = $canonical_counts[$cid]['success_count'];
                $item['sent_count'] = $canonical_counts[$cid]['accepted_count'];
                $item['accepted_count'] = $canonical_counts[$cid]['accepted_count'];
                $item['failed_count'] = $canonical_counts[$cid]['failed_count'];
                $item['pending_count'] = $canonical_counts[$cid]['pending_count'];
                $item['queued_count'] = $canonical_counts[$cid]['queued_count'];
                $item['skipped_count'] = $canonical_counts[$cid]['skipped_count'];
                $item['duplicate_count'] = $canonical_counts[$cid]['duplicate_count'];
                $item['invalid_count'] = $canonical_counts[$cid]['invalid_count'];
            }
            $successful = intval($item['success_count'] ?? 0) + intval($item['accepted_count'] ?? 0);
            $failed = intval($item['failed_count'] ?? 0);
            $waiting = intval($item['pending_count'] ?? 0) + intval($item['queued_count'] ?? 0);
            $job_total = intval($item['job_total'] ?? 0);
            $item['status'] = $failed > 0 ? 'failed' : ($waiting > 0 || $job_total === 0 ? 'processing' : 'successful');
            $item['status_label'] = $item['status'] === 'processing' ? __('Sending', 'bulk-sms-portal') : ($failed > 0 ? __('Failed', 'bulk-sms-portal') : __('Successful', 'bulk-sms-portal'));
            if ($admin) {
                $item['user_label'] = trim((string)($item['user_name'] ?? '')) ?: (sprintf(/* translators: %s: a value filled in when shown */ __('User #%s', 'bulk-sms-portal'), intval($item['user_id'])));
            } else {
                unset($item['user_id'], $item['user_name'], $item['user_email']);
                // Customer reports never expose infrastructure metadata.
                foreach (array('api_id','provider','provider_id','provider_route','gateway','gateway_id') as $private_key) {
                    if (array_key_exists($private_key, $item)) unset($item[$private_key]);
                }
            }
        }
        unset($item);
        return self::paginated_response($items, $total, $page, $per_page, array('scope'=>$admin?'platform':'account'));
    }



    public static function delete_group(WP_REST_Request $r){
        global $wpdb;
        $uid = get_current_user_id();
        $gid = intval($r['group_id']);
        $g = BSMS_DB::table('phone_groups');
        $n = BSMS_DB::table('phone_group_numbers');
        $wpdb->delete($n, array('group_id'=>$gid, 'user_id'=>$uid), array('%d','%d'));
        $wpdb->delete($g, array('id'=>$gid, 'user_id'=>$uid), array('%d','%d'));
        return array('ok'=>true);
    }

    public static function delete_template(WP_REST_Request $r){
        global $wpdb;
        $t = BSMS_DB::table('templates');
        $wpdb->delete($t, array('id'=>intval($r['template_id']), 'user_id'=>get_current_user_id()), array('%d','%d'));
        return array('ok'=>true);
    }

    public static function report_detail(WP_REST_Request $r){
        global $wpdb;
        $uid = get_current_user_id();
        // v1.7.9: one report-detail source. The REST route uses `id`, while older UI code
        // may still send `campaign_id`; support both so View Details never resolves to 0.
        $cid = intval($r->get_param('id') ?: $r->get_param('campaign_id'));
        $c = BSMS_DB::table('campaigns');
        $j = BSMS_DB::table('jobs');
        $l = BSMS_DB::table('ledger');
        if (self::can_manage_platform()) {
            $campaign = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_campaigns WHERE id=%d", $cid), ARRAY_A);
        } else {
            $campaign = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_campaigns WHERE id=%d AND user_id=%d", $cid, $uid), ARRAY_A);
        }
        if (!$campaign) {
            return new WP_REST_Response(array(
                'ok'=>false,
                'error'=>__('Campaign/report record was not found or is not accessible for this account.', 'bulk-sms-portal'),
                'campaign_id'=>$cid,
                'jobs'=>array(),
                'summary'=>self::empty_report_summary(),
            ), 404);
        }
        if (self::can_manage_platform()) {
            $origin = get_user_by('id', intval($campaign['user_id']));
            $campaign['user_name'] = $origin ? $origin->display_name : (sprintf(/* translators: %s: a value filled in when shown */ __('User #%s', 'bulk-sms-portal'), intval($campaign['user_id'])));
            $campaign['user_email'] = $origin ? $origin->user_email : '';
        }
        $jobs = $wpdb->get_results($wpdb->prepare(
            "SELECT j.id, j.to_phone_e164, j.recipient, j.sender_id, j.route, j.provider, j.api_id, j.network, j.status_bucket, j.provider_status, j.provider_message_id, j.err_code, j.last_error, j.last_synced_at, j.sync_notes, j.unit_price_kobo, j.cost_kobo, j.sent_at, j.delivered_at, j.updated_at, -COALESCE(lc.amount_kobo,0) charged_amount_kobo, COALESCE(lr.amount_kobo,0) refunded_amount_kobo
             FROM {$wpdb->prefix}bsms_jobs j LEFT JOIN {$wpdb->prefix}bsms_ledger lc ON lc.reference=CONCAT('JOB-',j.id) AND lc.type='sms_charge' AND lc.user_id=j.user_id LEFT JOIN {$wpdb->prefix}bsms_ledger lr ON lr.reference=CONCAT('REFUND-JOB-',j.id) AND lr.amount_kobo>0 AND lr.user_id=j.user_id WHERE j.campaign_id=%d ORDER BY j.id ASC",
             $cid
        ), ARRAY_A);
        $api_names = array();
        $api_records = array();
        if (self::can_manage_platform() && class_exists('BSMS_Providers')) {
            foreach (BSMS_Providers::all_apis() as $api_row) {
                $api_names[intval($api_row->id)] = (string)$api_row->name;
                $api_records[intval($api_row->id)] = $api_row;
            }
        }
        $summary = self::empty_report_summary();
        foreach ($jobs as &$job) {
            $summary['total']++;
            $stored_bucket = (string)($job['status_bucket'] ?: 'queued');
            $canonical = class_exists('BSMS_Providers') ? BSMS_Providers::canonical_job_status($job) : $stored_bucket;
            $bucket = $canonical === 'delivered' ? 'success' : ($canonical === 'accepted' ? 'sent' : $canonical);
            if (in_array($canonical, array('accepted','delivered','pending','failed'), true)) $summary['submitted']++;
            if ($canonical === 'delivered') $summary['delivered']++;
            if ($canonical === 'accepted') $summary['sent_accepted']++;
            if ($bucket === 'failed') $summary['failed']++;
            if ($bucket === 'pending') $summary['pending']++;
            if ($bucket === 'pending' && strtoupper((string)($job['provider_status'] ?? '')) === 'NO_FINAL_CONFIRMATION') $summary['no_final_confirmation']++;
            if ($bucket === 'queued') $summary['queued']++;
            if ($bucket === 'skipped') $summary['skipped']++;
            if ($job['err_code'] === 'DUPLICATE') $summary['duplicates']++;
            if ($job['err_code'] === 'INVALID_NUMBER') $summary['invalid']++;
            $summary['charged_kobo'] += intval($job['charged_amount_kobo']);
            $summary['refunded_kobo'] += intval($job['refunded_amount_kobo']);
            $summary['total_cost_kobo'] += intval($job['cost_kobo']);
            if ($bucket === 'failed' && !self::can_manage_platform()) {
                $job['error_reason'] = intval($job['refunded_amount_kobo']) > 0 ? __('The SMS service reported a failed message. The charge was returned to your balance.', 'bulk-sms-portal') : __('The message failed. Please contact support if a charge has not been returned.', 'bulk-sms-portal');
            } elseif ($canonical === 'accepted' && $stored_bucket === 'failed') {
                $job['error_reason'] = __('The configured SMS service recognised this response as successful.', 'bulk-sms-portal');
            } elseif (strtoupper((string)($job['provider_status'] ?? '')) === 'NOT_SUBMITTED' && !empty($job['last_error'])) {
                $job['error_reason'] = $job['last_error'];
            } elseif (!empty($job['err_code']) && class_exists('BSMS_Providers') && method_exists('BSMS_Providers', 'error_reason')) {
                $job_api_id = intval($job['api_id'] ?? 0);
                $job_api = $job_api_id && isset($api_records[$job_api_id]) ? $api_records[$job_api_id] : null;
                $job['error_reason'] = BSMS_Providers::error_reason($job['err_code'], $job_api);
            } else {
                $job['error_reason'] = $job['last_error'];
            }
            $job['display_status'] = $canonical === 'failed' ? __('Failed', 'bulk-sms-portal') : (in_array($canonical, array('accepted','delivered'), true) ? __('Successful', 'bulk-sms-portal') : __('Sending', 'bulk-sms-portal'));
            $job['reference_label'] = (strpos((string)($job['provider_message_id'] ?? ''), 'LOCAL-') === 0) ? __('Internal Reference', 'bulk-sms-portal') : __('Tracking Reference', 'bulk-sms-portal');
            $job['dlr_note'] = $canonical === 'failed' ? __('The message failed.', 'bulk-sms-portal') : (in_array($canonical, array('accepted','delivered'), true) ? __('The SMS service accepted the message.', 'bulk-sms-portal') : __('The SMS service has not returned a result yet.', 'bulk-sms-portal'));
            $job['refund_status'] = intval($job['refunded_amount_kobo']) > 0 ? __('Money returned', 'bulk-sms-portal') : (intval($job['charged_amount_kobo']) > 0 ? ($bucket === 'failed' ? __('Refund being reviewed', 'bulk-sms-portal') : __('Charged', 'bulk-sms-portal')) : __('Not charged', 'bulk-sms-portal'));
            if (self::can_manage_platform()) {
                $aid = intval($job['api_id'] ?? 0);
                $job['admin_provider_tracking'] = array(
                    'api_id' => $aid,
                    'api_name' => $aid && isset($api_names[$aid]) ? $api_names[$aid] : ($aid ? 'API #' . $aid : __('Not recorded', 'bulk-sms-portal')),
                    'route' => (string)($job['route'] ?? ''),
                    'provider_status' => (string)($job['provider_status'] ?? ''),
                    'last_synced_at' => (string)($job['last_synced_at'] ?? ''),
                    'sync_notes' => (string)($job['sync_notes'] ?? ''),
                );
            } else {
                unset($job['id'], $job['provider'], $job['api_id'], $job['route'], $job['provider_status'], $job['last_synced_at'], $job['sync_notes'], $job['status_bucket'], $job['err_code'], $job['last_error'], $job['unit_price_kobo']);
            }
        }
        if (!self::can_manage_platform()) {
            // Never expose infrastructure/provider routing metadata in customer responses.
            foreach (array('user_id','api_id','provider','route','provider_route','gateway','gateway_id','provider_id','provider_response','provider_payload','sync_notes') as $private_key) {
                if (array_key_exists($private_key, $campaign)) unset($campaign[$private_key]);
            }
        }
        if (!$jobs) {
            $summary['notice'] = __('No recipient detail rows were recorded for this campaign. The campaign header exists, but the recipient/job log is empty.', 'bulk-sms-portal');
        }
        return array('ok'=>true,'campaign'=>$campaign,'jobs'=>$jobs,'summary'=>$summary,'can_manage'=>self::can_manage_platform());
    }

    public static function report_job_sync(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        if (!self::can_manage_platform()) return new WP_REST_Response(array('ok'=>false,'error'=>__('Not allowed', 'bulk-sms-portal')), 403);
        global $wpdb;
        $cid = intval($r->get_param('id'));
        $job_id = intval($r->get_param('job_id'));
        $jt = BSMS_DB::table('jobs');
        $job = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_jobs WHERE id=%d AND campaign_id=%d", $job_id, $cid));
        if (!$job) return new WP_REST_Response(array('ok'=>false,'error'=>__('Job not found', 'bulk-sms-portal')), 404);
        if (!class_exists('BSMS_DLR') || !method_exists('BSMS_DLR', 'sync_job')) return new WP_REST_Response(array('ok'=>false,'error'=>__('DLR sync engine is not available.', 'bulk-sms-portal')), 500);
        $res = BSMS_DLR::sync_job($job_id);
        if (is_wp_error($res)) return new WP_REST_Response(array('ok'=>false,'error'=>$res->get_error_message()), 500);
        if (class_exists('BSMS_Security')) BSMS_Security::log('report_job_sync','Admin synced delivery status', array('campaign_id'=>$cid,'job_id'=>$job_id,'result'=>$res), 'job', $job_id);
        return array('ok'=>true) + $res;
    }

    public static function report_sync_pending(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        if (!self::can_manage_platform()) return new WP_REST_Response(array('ok'=>false,'error'=>__('Not allowed', 'bulk-sms-portal')), 403);
        global $wpdb;
        $cid = intval($r->get_param('id'));
        $limit = max(1, min(500, intval($r->get_param('limit') ?: 200)));
        $jt = BSMS_DB::table('jobs');
        $job_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d AND status_bucket='pending' ORDER BY updated_at ASC, id ASC LIMIT %d", $cid, $limit));
        $checked = 0; $updated = 0; $skipped = 0; $errors = 0; $details = array();
        foreach ($job_ids as $job_id) {
            $res = class_exists('BSMS_DLR') && method_exists('BSMS_DLR', 'sync_job') ? BSMS_DLR::sync_job(intval($job_id)) : new WP_Error('bsms_dlr_missing',__('DLR sync engine is not available.', 'bulk-sms-portal'));
            if (is_wp_error($res)) { $errors++; $details[] = array('job_id'=>intval($job_id),'ok'=>false,'error'=>$res->get_error_message()); continue; }
            $checked++;
            if (!empty($res['updated'])) $updated++;
            if (!empty($res['skipped'])) $skipped++;
            $details[] = array('job_id'=>intval($job_id),'ok'=>true,'status'=>$res['status'] ?? '', 'updated'=>!empty($res['updated']), 'note'=>$res['note'] ?? '');
        }
        if (class_exists('BSMS_Security')) BSMS_Security::log('report_sync_pending','Admin synced pending delivery reports', array('campaign_id'=>$cid,'checked'=>$checked,'updated'=>$updated,'skipped'=>$skipped,'errors'=>$errors), 'campaign', $cid);
        return array('ok'=>true,'campaign_id'=>$cid,'checked'=>$checked,'updated'=>$updated,'skipped'=>$skipped,'errors'=>$errors,'details'=>$details);
    }

    public static function report_job_status(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        if (!self::can_manage_platform()) return new WP_REST_Response(array('ok'=>false,'error'=>__('Not allowed', 'bulk-sms-portal')), 403);
        global $wpdb;
        $cid = intval($r->get_param('id'));
        $job_id = intval($r->get_param('job_id'));
        $status = strtolower(sanitize_text_field($r->get_param('status')));
        $allowed = array('pending','success','failed','expired','no_final_confirmation');
        if (!in_array($status, $allowed, true)) return new WP_REST_Response(array('ok'=>false,'error'=>__('Unsupported status', 'bulk-sms-portal')), 400);
        $jt = BSMS_DB::table('jobs');
        $job = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_jobs WHERE id=%d AND campaign_id=%d", $job_id, $cid));
        if (!$job) return new WP_REST_Response(array('ok'=>false,'error'=>__('Job not found', 'bulk-sms-portal')), 404);
        if ($status === 'success') {
            $ledger = BSMS_DB::table('ledger');
            if ($wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bsms_ledger WHERE reference=%s AND user_id=%d LIMIT 1", 'REFUND-JOB-' . $job_id, $job->user_id))) {
                return new WP_REST_Response(array('ok'=>false,'error'=>__('This message was refunded. Review its charge before changing it to successful.', 'bulk-sms-portal')), 409);
            }
        }
        $now = BSMS_Util::now_gmt();
        $bucket = $status === 'success' ? 'success' : ($status === 'failed' || $status === 'expired' ? 'failed' : 'pending');
        $provider_status = $status === 'no_final_confirmation' ? 'NO_FINAL_CONFIRMATION' : strtoupper($status);
        $data = array('status_bucket'=>$bucket, 'provider_status'=>$provider_status, 'last_synced_at'=>$now, 'sync_notes'=>sprintf(/* translators: %s: a value filled in when shown */ __('Manual admin reconciliation at %s.', 'bulk-sms-portal'), $now), 'updated_at'=>$now);
        if ($bucket === 'success') $data['delivered_at'] = $now;
        if ($bucket === 'failed') {
            $data['err_code'] = $status === 'expired' ? 'EXPIRED' : 'ADMIN_FAILED';
            $data['last_error'] = sprintf(/* translators: %s: a value filled in when shown */ __('Manually reconciled by admin as %s', 'bulk-sms-portal'), $status);
        } else {
            $data['last_error'] = sprintf(/* translators: %s: a value filled in when shown */ __('Manually reconciled by admin as %s', 'bulk-sms-portal'), $status);
        }
        // v3.4.2: an admin marking a message failed returns its charge, exactly as
        // a failed delivery report does (one refund at most, matched to the charge).
        $refunded = false;
        if ($bucket === 'failed') {
            $ledger = BSMS_DB::table('ledger');
            $charge = $wpdb->get_row($wpdb->prepare("SELECT amount_kobo FROM {$wpdb->prefix}bsms_ledger WHERE reference=%s AND type='sms_charge' AND user_id=%d LIMIT 1", 'JOB-' . $job_id, intval($job->user_id)));
            if ($charge && intval($charge->amount_kobo) < 0) {
                $refund = BSMS_Wallet::refund_sms_job(intval($job->user_id), $job_id, abs(intval($charge->amount_kobo)), array('campaign_id'=>$cid, 'reason'=>__('Marked failed by admin', 'bulk-sms-portal'), 'admin'=>get_current_user_id()));
                if (is_wp_error($refund)) return new WP_REST_Response(array('ok'=>false,'error'=>sprintf(/* translators: %s: a value filled in when shown */ __('The result was not changed because the refund could not be made: %s', 'bulk-sms-portal'), $refund->get_error_message())), 409);
                $refunded = true;
                $data['err_code'] = 'ADMIN_FAILED_REFUNDED';
                $data['last_error'] = __('Marked failed by admin. The charge was returned to the wallet.', 'bulk-sms-portal');
            }
        }
        $wpdb->update($jt, $data, array('id'=>$job_id));
        if (class_exists('BSMS_Security')) BSMS_Security::log('report_job_status','Admin updated delivery status', array('campaign_id'=>$cid,'job_id'=>$job_id,'status'=>$status,'refunded'=>$refunded), 'job', $job_id);
        return array('ok'=>true,'job_id'=>$job_id,'status'=>$status,'refunded'=>$refunded);
    }


    private static function empty_report_summary(){
        return array('total'=>0,'submitted'=>0,'sent_accepted'=>0,'delivered'=>0,'failed'=>0,'pending'=>0,'queued'=>0,'skipped'=>0,'duplicates'=>0,'invalid'=>0,'no_final_confirmation'=>0,'charged_kobo'=>0,'refunded_kobo'=>0,'total_cost_kobo'=>0);
    }




    // v2.8.0 Stage 3 owner settings surface. Secrets are never returned; blank secret fields preserve existing values.
    public static function admin_platform_settings_get(){
        if (!self::can_manage_platform()) return self::forbidden();
        $banks = json_decode((string)get_option('bsms_bank_accounts_json','[]'), true);
        if (!is_array($banks)) $banks = array();
        $settings = array(
            'branding'=>array(
                'brand_name'=>get_option('bsms_brand_name', BSMS_Util::brand_name()),
                'logo_url'=>BSMS_Util::logo_url_raw(),
                'logo_attachment_id'=>absint(get_option('bsms_logo_attachment_id', 0)),
                'sidebar_brand_display'=>get_option('bsms_sidebar_brand_display','logo_only'),
                'portal_slug'=>get_option('bsms_portal_slug','portal'),
                'support_email'=>BSMS_Util::support_email(),
                'transactional_from_email'=>get_option('bsms_transactional_from_email',''),
                'admin_notification_email'=>get_option('bsms_admin_notification_email', get_option('admin_email','')),
                'default_sender'=>BSMS_Util::shared_sender(),
                'primary_color'=>get_option('bsms_primary_color','#51912d'),
                'secondary_color'=>get_option('bsms_secondary_color','#111827'),
                'background_color'=>get_option('bsms_background_color','#f8fafc'),
                'surface_color'=>get_option('bsms_surface_color','#ffffff')
            ),
            'payments'=>array(
                'currency'=>get_option('bsms_payment_currency','NGN'),
                'minimum'=>floatval(get_option('bsms_minimum_funding_amount',0)),
                'maximum'=>floatval(get_option('bsms_maximum_funding_amount',0)),
                'quick_amounts'=>get_option('bsms_quick_funding_amounts','1000,2500,5000,10000,25000'),
                'test_mode'=>intval(get_option('bsms_payment_test_mode',0)),
                'paystack'=>intval(get_option('bsms_enable_paystack',1)),
                'paystack_public_key'=>get_option('bsms_paystack_public_key',''),
                'paystack_secret_set'=>(bool)get_option('bsms_paystack_secret_key','')
            ),
            'funding'=>array('accounts'=>$banks,'instructions'=>get_option('bsms_manual_funding_instructions','')),
            'security'=>array(
                'recaptcha_enabled'=>intval(get_option('bsms_recaptcha_enabled',0)),
                'recaptcha_site_key'=>get_option('bsms_recaptcha_site_key',''),
                'recaptcha_secret_set'=>(bool)get_option('bsms_recaptcha_secret_key',''),
                'recaptcha_login'=>intval(get_option('bsms_recaptcha_apply_login',1)),
                'recaptcha_register'=>intval(get_option('bsms_recaptcha_apply_register',1)),
                'recaptcha_forgot'=>intval(get_option('bsms_recaptcha_apply_forgot',1)),
                'honeypot'=>intval(get_option('bsms_auth_honeypot_enabled',1)),
                'min_form_seconds'=>intval(get_option('bsms_auth_min_form_seconds',2))
            ),
            'features'=>array(
                'compose_sms'=>intval(get_option('bsms_feature_compose_sms',1)),
                'phone_groups'=>intval(get_option('bsms_feature_phone_groups',1)),
                'message_history'=>intval(get_option('bsms_feature_message_history',1)),
                'delivery_reports'=>intval(get_option('bsms_feature_delivery_reports',1)),
                'buy_sms'=>intval(get_option('bsms_feature_buy_sms',1)),
                'manual_funding'=>intval(get_option('bsms_feature_manual_funding',1)),
                'transactions'=>intval(get_option('bsms_feature_transactions',1)),
                'sender_ids'=>intval(get_option('bsms_feature_sender_ids',1)),
                'broadcast'=>intval(get_option('bsms_feature_broadcast',1)),
                'pricing'=>intval(get_option('bsms_feature_pricing',1)),
                'frontend_admin'=>intval(get_option('bsms_feature_frontend_admin',1)),
                'developer_tools'=>intval(get_option('bsms_enable_developer_tools',0)),
                'scheduled_sms'=>intval(get_option('bsms_entitlement_feature_scheduled_sms',1)),
                'templates'=>intval(get_option('bsms_entitlement_feature_templates',1)),
                'notifications'=>intval(get_option('bsms_entitlement_feature_notifications',1)),
                'api_access'=>intval(get_option('bsms_feature_api_access',0)),
                'limit_phone_groups'=>intval(get_option('bsms_entitlement_limit_phone_groups',0)),
                'limit_contacts_per_group'=>intval(get_option('bsms_entitlement_limit_contacts_per_group',0)),
                'limit_templates'=>intval(get_option('bsms_entitlement_limit_templates',0)),
                'limit_sender_ids'=>intval(get_option('bsms_entitlement_limit_sender_ids',0)),
                'limit_campaigns_per_day'=>intval(get_option('bsms_entitlement_limit_campaigns_per_day',0)),
                'limit_recipients_per_campaign'=>intval(get_option('bsms_entitlement_limit_recipients_per_campaign',0)),
                'limit_api_keys'=>intval(get_option('bsms_entitlement_limit_api_keys',0))
            ),
            'system'=>array(
                'api_rate_limit'=>intval(get_option('bsms_api_rate_limit_per_minute',60)),
                'log_retention_days'=>intval(get_option('bsms_log_retention_days',180)),
                'success_after_minutes'=>intval(get_option('bsms_success_after_minutes',60)),
                'delete_data_on_uninstall'=>intval(get_option('bsms_delete_data_on_uninstall',0))
            )
        );
        // Add-ons add their own settings to a section here.
        return array('ok'=>true,'settings'=>apply_filters('bsms_platform_settings', $settings));
    }

    public static function admin_platform_settings_save($request){
        if (!self::can_manage_platform()) return self::forbidden();
        $p=(array)$request->get_json_params(); $section=sanitize_key($p['section'] ?? ''); $d=(array)($p['data'] ?? array());
        $bool=function($v){ return !empty($v) ? 1 : 0; };
        if ($section==='branding') {
            update_option('bsms_brand_name',sanitize_text_field($d['brand_name']??''));
            $old_logo = BSMS_Util::logo_url_raw();
            $new_logo = esc_url_raw($d['logo_url']??'');
            $selected_attachment_id = absint($d['logo_attachment_id'] ?? 0);
            if (!$new_logo && !$selected_attachment_id) {
                update_option('bsms_logo_attachment_id', 0);
                update_option('bsms_logo_url', '');
            } elseif ($selected_attachment_id) {
                // Native Media Library selection is authoritative. Persist the
                // attachment, then derive the URL from WordPress instead of
                // maintaining two independent logo states.
                $mime = (string)get_post_mime_type($selected_attachment_id);
                $attachment_url = wp_get_attachment_url($selected_attachment_id);
                if (!$attachment_url || strpos($mime, 'image/') !== 0) {
                    return new WP_Error('bsms_bad_logo', __('Choose a valid image from the Media Library.', 'bulk-sms-portal'), array('status'=>400));
                }
                update_option('bsms_logo_attachment_id', $selected_attachment_id);
                update_option('bsms_logo_url', esc_url_raw($attachment_url));
            } else {
                // Backwards-compatible manual URL path.
                $resolved_id = function_exists('attachment_url_to_postid') ? absint(attachment_url_to_postid($new_logo)) : 0;
                update_option('bsms_logo_attachment_id', $resolved_id);
                update_option('bsms_logo_url', $new_logo);
            }
            if ($old_logo !== BSMS_Util::logo_url_raw()) update_option('bsms_logo_revision', time());
            $disp=sanitize_key($d['sidebar_brand_display']??'logo_only'); if(!in_array($disp,array('logo_only','name_only','logo_name'),true))$disp='logo_only'; update_option('bsms_sidebar_brand_display',$disp);
            $slug=sanitize_title($d['portal_slug']??'portal'); update_option('bsms_portal_slug',$slug?:'portal'); update_option('bsms_support_email',sanitize_email($d['support_email']??'')); if (array_key_exists('transactional_from_email',$d)) { $mail_from=sanitize_email($d['transactional_from_email']); update_option('bsms_transactional_from_email',$mail_from?:''); } if (array_key_exists('admin_notification_email',$d)) { $admin_notice=sanitize_email($d['admin_notification_email']); if ($admin_notice && is_email($admin_notice)) update_option('bsms_admin_notification_email',$admin_notice); else delete_option('bsms_admin_notification_email'); } update_option('bsms_default_sender',sanitize_text_field($d['default_sender']??'SMS'));
            foreach(array('primary_color','secondary_color','background_color','surface_color') as $k){$v=sanitize_hex_color($d[$k]??'');if($v)update_option('bsms_'.$k,$v);}
        } elseif ($section==='payments') {
            update_option('bsms_payment_currency',strtoupper(sanitize_text_field($d['currency']??'NGN'))); update_option('bsms_minimum_funding_amount',max(0,floatval($d['minimum']??0))); update_option('bsms_maximum_funding_amount',max(0,floatval($d['maximum']??0))); update_option('bsms_quick_funding_amounts',sanitize_text_field($d['quick_amounts']??'')); update_option('bsms_payment_test_mode',$bool($d['test_mode']??0));
            update_option('bsms_enable_paystack',$bool($d['paystack']??0)); update_option('bsms_paystack_public_key',sanitize_text_field($d['paystack_public_key']??'')); if(!empty($d['paystack_secret']))update_option('bsms_paystack_secret_key',sanitize_text_field($d['paystack_secret']));
        } elseif ($section==='funding') {
            $accounts=array(); foreach((array)($d['accounts']??array()) as $a){$bank=sanitize_text_field($a['bank']??'');$num=sanitize_text_field($a['account_number']??'');if(!$bank&&!$num)continue;$accounts[]=array('bank'=>$bank,'account_name'=>sanitize_text_field($a['account_name']??''),'account_number'=>$num,'currency'=>strtoupper(sanitize_text_field($a['currency']??'NGN')),'instructions'=>sanitize_textarea_field($a['instructions']??''),'active'=>$bool($a['active']??0));} update_option('bsms_bank_accounts_json',wp_json_encode($accounts)); update_option('bsms_manual_funding_instructions',sanitize_textarea_field($d['instructions']??''));
        } elseif ($section==='security') {
            update_option('bsms_recaptcha_enabled',$bool($d['recaptcha_enabled']??0)); update_option('bsms_recaptcha_site_key',sanitize_text_field($d['recaptcha_site_key']??'')); if(!empty($d['recaptcha_secret']))update_option('bsms_recaptcha_secret_key',sanitize_text_field($d['recaptcha_secret'])); update_option('bsms_recaptcha_apply_login',$bool($d['recaptcha_login']??0)); update_option('bsms_recaptcha_apply_register',$bool($d['recaptcha_register']??0)); update_option('bsms_recaptcha_apply_forgot',$bool($d['recaptcha_forgot']??0)); update_option('bsms_auth_honeypot_enabled',$bool($d['honeypot']??0)); update_option('bsms_auth_min_form_seconds',max(0,intval($d['min_form_seconds']??2)));
        } elseif ($section==='features') {
            $map=array(
                'compose_sms'=>'bsms_feature_compose_sms','phone_groups'=>'bsms_feature_phone_groups',
                'message_history'=>'bsms_feature_message_history','delivery_reports'=>'bsms_feature_delivery_reports',
                'buy_sms'=>'bsms_feature_buy_sms','manual_funding'=>'bsms_feature_manual_funding',
                'transactions'=>'bsms_feature_transactions','sender_ids'=>'bsms_feature_sender_ids',
                'api_access'=>'bsms_feature_api_access','broadcast'=>'bsms_feature_broadcast',
                'pricing'=>'bsms_feature_pricing','frontend_admin'=>'bsms_feature_frontend_admin',
                'developer_tools'=>'bsms_enable_developer_tools',
                'scheduled_sms'=>'bsms_entitlement_feature_scheduled_sms',
                'templates'=>'bsms_entitlement_feature_templates',
                'notifications'=>'bsms_entitlement_feature_notifications'
            );
            foreach($map as $k=>$opt) {
                // Do not turn hidden/legacy controls off merely because the
                // current settings form did not submit them.
                if (array_key_exists($k,$d)) update_option($opt,$bool($d[$k]));
            }
            foreach(array('phone_groups','contacts_per_group','templates','sender_ids','campaigns_per_day','recipients_per_campaign','api_keys') as $k){
                $limit_key='limit_'.$k;
                if (array_key_exists($limit_key,$d)) update_option('bsms_entitlement_limit_'.$k,max(0,intval($d[$limit_key])));
            }
        } elseif ($section==='system') {
            update_option('bsms_api_rate_limit_per_minute',max(1,intval($d['api_rate_limit']??60))); update_option('bsms_log_retention_days',max(0,min(3650,intval($d['log_retention_days']??180)))); if (isset($d['success_after_minutes'])) update_option('bsms_success_after_minutes',max(0,min(1440,intval($d['success_after_minutes'])))); update_option('bsms_delete_data_on_uninstall',$bool($d['delete_data_on_uninstall']??0));
        } else return new WP_Error('bsms_bad_section',__('Unknown settings section.', 'bulk-sms-portal'),array('status'=>400));
        do_action('bsms_platform_settings_save', $section, $d); // add-ons save their own settings
        if(class_exists('BSMS_Security'))BSMS_Security::log('platform_settings_saved','Front-end Platform Admin settings updated',array('section'=>$section));
        $response=array('ok'=>true,'message'=>__('Settings saved.', 'bulk-sms-portal'));
        if ($section==='branding') {
            $response['brand']=array(
                'name'=>BSMS_Util::brand_name(),
                'logo'=>BSMS_Util::logo_url(),
                'sidebar_brand_display'=>get_option('bsms_sidebar_brand_display','logo_only'),
            );
        }
        return $response;
    }

    public static function admin_platform_health(){
        if (!self::can_manage_platform()) return self::forbidden();
        global $wpdb; $checks=array();
        $checks[]=array('label'=>__('Database', 'bulk-sms-portal'),'status'=>($wpdb->last_error?'warning':'healthy'),'detail'=>$wpdb->last_error?:__('Database connection available', 'bulk-sms-portal'));
        $checks[]=array('label'=>__('Cron', 'bulk-sms-portal'),'status'=>(wp_next_scheduled('bsms_pro_queue_worker')?'healthy':'warning'),'detail'=>wp_next_scheduled('bsms_pro_queue_worker')?__('Scheduled worker detected', 'bulk-sms-portal'):__('Scheduled worker not detected', 'bulk-sms-portal'));
        $checks[]=array('label'=>__('Frontend Admin', 'bulk-sms-portal'),'status'=>get_option('bsms_feature_frontend_admin',1)?'healthy':'warning','detail'=>get_option('bsms_feature_frontend_admin',1)?__('Enabled', 'bulk-sms-portal'):__('Disabled', 'bulk-sms-portal'));
        $checks[]=array('label'=>__('Payments', 'bulk-sms-portal'),'status'=>(get_option('bsms_enable_paystack',1)||apply_filters('bsms_other_payments_ready', false)||get_option('bsms_enable_woocommerce',0))?'healthy':'warning','detail'=>__('Funding gateway configuration', 'bulk-sms-portal'));
        $own_sender=trim((string)get_option('bsms_default_sender','')); $checks[]=array('label'=>__('Sender ID', 'bulk-sms-portal'),'status'=>($own_sender!=='' && strtoupper($own_sender)!=='SMS')?'healthy':'warning','detail'=>($own_sender!=='' && strtoupper($own_sender)!=='SMS')?sprintf(/* translators: %s: a value filled in when shown */ __('Shared sender name: %s', 'bulk-sms-portal'), BSMS_Util::shared_sender()):__('Customers without their own name send as “SMS”. Set your brand as the shared sender name.', 'bulk-sms-portal'));
        $apis=BSMS_DB::table('apis'); $active=intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_apis WHERE is_active=1"));
        $checks[]=array('label'=>__('Provider APIs', 'bulk-sms-portal'),'status'=>$active>0?'healthy':'warning','detail'=>$active.' active provider'.($active===1?'':'s'));
        // v3.7.0: a service that never sends delivery results back leaves every
        // message at "Sent"; nothing can ever show as Delivered or Failed.
        $jt=BSMS_DB::table('jobs'); $since=gmdate('Y-m-d H:i:s', time()-7*DAY_IN_SECONDS); $older=gmdate('Y-m-d H:i:s', time()-HOUR_IN_SECONDS);
        $dl=$wpdb->get_results($wpdb->prepare("SELECT j.api_id, MAX(a.name) AS name, SUM(CASE WHEN j.status_bucket IN ('success','delivered') OR (j.delivered_at IS NOT NULL AND j.delivered_at<>'') OR j.status_bucket='failed' THEN 1 ELSE 0 END) AS results, COUNT(*) AS n FROM {$wpdb->prefix}bsms_jobs j LEFT JOIN {$wpdb->prefix}bsms_apis a ON a.id=j.api_id WHERE j.api_id>0 AND j.sent_at>=%s AND j.sent_at<=%s AND j.status_bucket NOT IN ('skipped','queued') GROUP BY j.api_id", $since, $older), ARRAY_A);
        $silent=array(); foreach((array)$dl as $x){ if(intval($x['n'])>=3 && intval($x['results'])===0) $silent[]=(string)($x['name']?:(sprintf(/* translators: %s: a value filled in when shown */ __('Service #%s', 'bulk-sms-portal'), $x['api_id']))); }
        $checks[]=array('label'=>__('Delivery results', 'bulk-sms-portal'),'status'=>$silent?'warning':'healthy','detail'=>$silent?(sprintf(/* translators: %s: a value filled in when shown */ __('%s: no delivery results have come back in the last 7 days, so its messages count as successful unless a failure is reported, and failures cannot be seen or refunded automatically. Set up delivery results on the service’s “Delivery results” tab.', 'bulk-sms-portal'), implode(', ',$silent))):__('Delivery results are coming back from your SMS services.', 'bulk-sms-portal'));
        $proof_count = get_option('bsms_legacy_public_proofs_remaining', null);
        $cleanup_failed = (bool) get_option('bsms_legacy_proof_cleanup_failed', false);
        $checks[]=array('label'=>__('Payment receipt privacy', 'bulk-sms-portal'),'status'=>($proof_count !== null && absint($proof_count) === 0 && !$cleanup_failed)?'healthy':'warning','detail'=>$cleanup_failed?__('Older payment receipts need manual cleanup', 'bulk-sms-portal'):($proof_count === null?__('Receipt migration has not been checked yet', 'bulk-sms-portal'):(sprintf(/* translators: %s: a value filled in when shown */ __('%s older receipt(s) still need moving to private storage', 'bulk-sms-portal'), absint($proof_count)))));
        foreach (BSMS_DB::money_integrity_checks() as $mc) $checks[]=array('label'=>$mc[0],'status'=>$mc[1]?'healthy':'warning','detail'=>$mc[2]);
        return array('ok'=>true,'version'=>defined('BSMS_PRO_VERSION')?BSMS_PRO_VERSION:'','php'=>PHP_VERSION,'wordpress'=>get_bloginfo('version'),'checks'=>$checks,'active_providers'=>$active,'developer_tools'=>intval(get_option('bsms_enable_developer_tools',0)));
    }

    public static function admin_activity(){
        if (!self::can_manage_platform()) return self::forbidden();
        $rows=class_exists('BSMS_Security')?BSMS_Security::recent(40):array(); $out=array(); foreach((array)$rows as $r){$out[]=array('id'=>intval($r->id??0),'action'=>sanitize_text_field($r->action??''),'message'=>sanitize_text_field($r->message??''),'actor_id'=>intval($r->actor_id??0),'user_id'=>intval($r->user_id??0),'ip_address'=>sanitize_text_field($r->ip_address??''),'created_at'=>sanitize_text_field($r->created_at??''));} return array('ok'=>true,'items'=>$out);
    }

    private static function help_content_defaults(){
        return array(
            'troubleshooting'=>array(
                array('id'=>'tr_delivery_pending','title'=>__('Why is my message still sending?', 'bulk-sms-portal'),'body'=>__('Most messages get a result within a few minutes. Some networks take longer to confirm. Open Delivery Reports to see the latest result. Please do not send the same message again while it is still sending, or the person may get it twice.', 'bulk-sms-portal'),'category'=>__('Sending SMS', 'bulk-sms-portal'),'keywords'=>'pending delivery route sender wallet','related_page'=>'reports','order'=>10,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'tr_delivery_failed','title'=>__('Why did a message fail?', 'bulk-sms-portal'),'body'=>__('The usual reasons are a wrong or switched-off phone number, a number on the Do Not Disturb list, or a sender name the network does not accept. Open Message History and tap the message to see the reason. The charge for a failed message is returned to your wallet.', 'bulk-sms-portal'),'category'=>__('Delivery & DND', 'bulk-sms-portal'),'keywords'=>'failed invalid number dnd provider','related_page'=>'reports','order'=>20,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'tr_funding_pending','title'=>__('I paid but my wallet has not changed', 'bulk-sms-portal'),'body'=>__('Online payments are added straight away. If you paid by bank transfer, we check your receipt first, which can take a little while during working hours. You can see where your transfer is on the Buy SMS page.', 'bulk-sms-portal'),'category'=>__('Funding & Wallet', 'bulk-sms-portal'),'keywords'=>'funding payment proof wallet pending','related_page'=>'fund','order'=>30,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'tr_sender','title'=>__('Why can’t I use my sender name?', 'bulk-sms-portal'),'body'=>__('A sender name can be used once it has been approved. While it is waiting, it will not appear on the Send SMS page. If it was not approved, the Sender ID page shows the reason and you can ask for a different name.', 'bulk-sms-portal'),'category'=>__('Sender IDs', 'bulk-sms-portal'),'keywords'=>'sender id approval rejected pending','related_page'=>'sender','order'=>40,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'tr_api','title'=>__('Why is my API request failing?', 'bulk-sms-portal'),'body'=>__('Check the API key, the web address, the sender name, the phone number format and the wallet balance. The response code in the reply tells you which one to fix.', 'bulk-sms-portal'),'category'=>__('API & Integrations', 'bulk-sms-portal'),'keywords'=>'api endpoint credentials integration','related_page'=>'api','order'=>50,'status'=>'published','enabled'=>1,'visibility'=>'admin')
            ),
            'knowledge'=>array(
                array('id'=>'kb_delivery','title'=>__('Understand message results', 'bulk-sms-portal'),'summary'=>__('What Successful, Failed, Sending and Not sent mean.', 'bulk-sms-portal'),'body'=>__('Successful means the network accepted your message and did not report a failure. Failed means it could not be delivered, and its charge is returned to your wallet, even if the failure is reported later. Sending means it has not reached the network yet, or was sent a short while ago. Not sent means it was left out, for example a repeated or wrong number, and it was not charged. Each message has a message ID you can quote to support.', 'bulk-sms-portal'),'category'=>__('Sending SMS', 'bulk-sms-portal'),'keywords'=>'message delivery delivered sent successful failed sms message id','related_page'=>'reports','order'=>10,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'kb_funding','title'=>__('How your wallet works', 'bulk-sms-portal'),'summary'=>__('Add money once, then pay for each SMS as you send.', 'bulk-sms-portal'),'body'=>__('Money you add on the Buy SMS page goes into your wallet. Each SMS you send takes its charge from the wallet. Online payments are added straight away; bank transfers are added once we have checked the receipt.', 'bulk-sms-portal'),'category'=>__('Funding & Wallet', 'bulk-sms-portal'),'keywords'=>'funding wallet payment bank credit','related_page'=>'fund','order'=>20,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'kb_sender','title'=>__('Getting a sender name approved', 'bulk-sms-portal'),'summary'=>__('Ask for the name people see when you text them.', 'bulk-sms-portal'),'body'=>__('Use your real business, school or church name, up to 11 letters or numbers. Add a sample of the messages you will send. Names that look like a bank, a network or a government office are usually not approved.', 'bulk-sms-portal'),'category'=>__('Sender IDs', 'bulk-sms-portal'),'keywords'=>'sender id approval identity','related_page'=>'sender','order'=>30,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'kb_api','title'=>__('API integration checklist', 'bulk-sms-portal'),'summary'=>__('What your developer needs to connect a website or app.', 'bulk-sms-portal'),'body'=>__('Your developer needs an API key, the web address for sending, an approved sender name and money in the wallet. All of these are on the API page.', 'bulk-sms-portal'),'category'=>__('API & Integrations', 'bulk-sms-portal'),'keywords'=>'api credentials endpoint integration developer','related_page'=>'api','order'=>40,'status'=>'published','enabled'=>1,'visibility'=>'admin'),
                array('id'=>'kb_security','title'=>__('Secure your account', 'bulk-sms-portal'),'summary'=>__('Keep your details and password up to date.', 'bulk-sms-portal'),'body'=>__('Use a password you do not use anywhere else. If you change your email address, we ask for your password first so nobody else can take over your account.', 'bulk-sms-portal'),'category'=>__('Account & Security', 'bulk-sms-portal'),'keywords'=>'password profile account security notification','related_page'=>'profile','order'=>50,'status'=>'published','enabled'=>1,'visibility'=>'everyone')
            ),
            'channels'=>array(
                array('id'=>'ch_email','title'=>__('Email support', 'bulk-sms-portal'),'summary'=>__('Best for account and payment questions', 'bulk-sms-portal'),'body'=>__('Tell us what happened and include the payment reference or the name of the send.', 'bulk-sms-portal'),'type'=>'email','value'=>'','availability'=>__('Available', 'bulk-sms-portal'),'order'=>10,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'ch_whatsapp','title'=>'WhatsApp','summary'=>__('Best for quick questions', 'bulk-sms-portal'),'body'=>__('Never share your password or API key with anyone, including us.', 'bulk-sms-portal'),'type'=>'whatsapp','value'=>'','availability'=>__('When configured', 'bulk-sms-portal'),'order'=>20,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'ch_technical','title'=>__('Technical support', 'bulk-sms-portal'),'summary'=>__('Best for website and app connections', 'bulk-sms-portal'),'body'=>__('Include the response code you received and what you were trying to do. Do not send your API key.', 'bulk-sms-portal'),'type'=>'technical','value'=>'','availability'=>__('Available', 'bulk-sms-portal'),'order'=>30,'status'=>'published','enabled'=>1,'visibility'=>'everyone')
            ),
            'suggestions'=>array(
                array('id'=>'sg_delivery','title'=>__('Message failed', 'bulk-sms-portal'),'query'=>'failed','order'=>10,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'sg_funding','title'=>__('Payment not showing', 'bulk-sms-portal'),'query'=>'wallet','order'=>20,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'sg_sender','title'=>__('Sender name', 'bulk-sms-portal'),'query'=>'sender name','order'=>30,'status'=>'published','enabled'=>1,'visibility'=>'everyone'),
                array('id'=>'sg_api','title'=>__('API credentials', 'bulk-sms-portal'),'query'=>'api credentials','order'=>40,'status'=>'published','enabled'=>1,'visibility'=>'admin')
            )
        );
    }
    public static function help_content_all(){
        $saved=get_option('bsms_help_content_v1',null);
        if(!is_array($saved)){$saved=self::help_content_defaults();update_option('bsms_help_content_v1',$saved,false);}
        foreach(array('troubleshooting','knowledge','channels','suggestions') as $type){if(!isset($saved[$type])||!is_array($saved[$type]))$saved[$type]=array();}
        // v3.7.2: re-run whenever the built-in wording changes (it used to run only once, so later wording never reached existing sites). Items an admin edited are left alone.
        if (get_option('bsms_help_content_plain_ver') !== '3.7.2') { $saved = self::help_content_plain_upgrade($saved); update_option('bsms_help_content_v1', $saved, false); update_option('bsms_help_content_plain_ver', '3.7.2', false); }
        return $saved;
    }
    /**
     * v3.5.0: replace the original built-in help wording with plain public
     * wording. Only items still exactly as shipped are changed; anything an
     * admin has edited is left alone.
     */
    private static function help_content_plain_upgrade($saved){
        $shipped = array(
            'tr_delivery_pending'=>'91fc0023dae5244805262ab5765427b0','tr_delivery_failed'=>'ca3f97ba75769003aa647a8e1cd64f6e','tr_funding_pending'=>'b3ce72862362a00d4758895669fcac8b',
            'tr_sender'=>'2cbf1a8fe93b3dc9ace0f190ccfb8885','tr_api'=>'9b3d64d178d89be39cdf177f704e2959','kb_delivery'=>array('204fb38ce22b4c8e0b66f3a58fb2eaec','0ea8b8b2363412bb11287af7d17f3d7b','56ad7a404b4affe739c87f814562eaf2'),'kb_funding'=>'967ddaddc12d225955f6acd67132fe79',
            'kb_sender'=>'2cc4a5aa76b0afa91c2c7ed699058ce8','kb_api'=>'a1636ed31faae85b75c4f66263af32ce','kb_security'=>'857b42a0704e5ffc73d55b2983648ee6','ch_email'=>'41dfb56d387a4b2be1f809c1f34cc88e',
            'ch_whatsapp'=>'84f053a651fa9c9e2be07555c3e77fc8','ch_technical'=>'1ba7484b94370f4c94851a943d9a1a10','sg_delivery'=>'ec89f7b6f92699f1e39643de64809b45','sg_funding'=>'001b9dc15f113e860e3501c51146692b',
            'sg_sender'=>'8996cc04ef584657a44fa0acb5d97d6e','sg_api'=>'faa6042a8c3f4dc57b3a9e12df58b074',
        );
        $fresh = array();
        foreach (self::help_content_defaults() as $type=>$items) foreach ($items as $it) $fresh[$it['id']] = $it;
        foreach ($saved as $type=>$items) {
            if (!is_array($items)) continue;
            foreach ($items as $i=>$it) {
                $id = $it['id'] ?? '';
                if (!isset($shipped[$id], $fresh[$id])) continue;
                $sig = md5(($it['title']??'').'|'.($it['summary']??'').'|'.($it['body']??'').'|'.($it['query']??''));
                if (!in_array($sig, (array)$shipped[$id], true)) continue;
                foreach (array('title','summary','body','query') as $k) if (isset($fresh[$id][$k])) $saved[$type][$i][$k] = $fresh[$id][$k];
            }
        }
        return $saved;
    }
    private static function help_content_visible($all,$admin=false){
        $out=array('troubleshooting'=>array(),'knowledge'=>array(),'channels'=>array(),'suggestions'=>array());
        foreach($out as $type=>$blank){foreach((array)($all[$type]??array()) as $item){
            if(empty($item['enabled'])||(($item['status']??'published')!=='published'))continue;
            $vis=$item['visibility']??'everyone';if($vis==='admin'&&!$admin)continue;$out[$type][]=$item;
        }usort($out[$type],function($a,$b){return intval($a['order']??0)<=>intval($b['order']??0);});}
        return $out;
    }
    public static function help_content_get(){return array('ok'=>true,'content'=>self::help_content_visible(self::help_content_all(),self::can_manage_platform()));}
    public static function admin_help_content_get(){return array('ok'=>true,'content'=>self::help_content_all());}
    private static function help_clean_item($type,$raw,$existing=array()){
        $id=sanitize_key($raw['id']??($existing['id']??''));if(!$id)$id=$type.'_'.wp_generate_password(10,false,false);
        $status=$raw['status']??($existing['status']??'published');if(!in_array($status,array('published','draft'),true))$status='draft';
        $visibility=$raw['visibility']??($existing['visibility']??'everyone');if(!in_array($visibility,array('everyone','users','admin'),true))$visibility='everyone';
        return array('id'=>$id,'title'=>sanitize_text_field($raw['title']??($existing['title']??'')),'summary'=>sanitize_textarea_field($raw['summary']??($existing['summary']??'')),'body'=>wp_kses_post($raw['body']??($existing['body']??'')),'category'=>sanitize_text_field($raw['category']??($existing['category']??'')),'keywords'=>sanitize_text_field($raw['keywords']??($existing['keywords']??'')),'related_page'=>sanitize_key($raw['related_page']??($existing['related_page']??'')),'order'=>intval($raw['order']??($existing['order']??10)),'status'=>$status,'enabled'=>empty($raw['enabled'])?0:1,'visibility'=>$visibility,'type'=>sanitize_key($raw['type']??($existing['type']??'')),'value'=>sanitize_text_field($raw['value']??($existing['value']??'')),'availability'=>sanitize_text_field($raw['availability']??($existing['availability']??'')),'query'=>sanitize_text_field($raw['query']??($existing['query']??'')));
    }
    public static function admin_help_content_save(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $type=sanitize_key($r->get_param('type'));if(!in_array($type,array('troubleshooting','knowledge','channels','suggestions'),true))return new WP_Error('bad_type',__('Invalid help content type', 'bulk-sms-portal'),array('status'=>400));
        $raw=$r->get_param('item');if(!is_array($raw))$raw=array();$all=self::help_content_all();$existing=array();$index=-1;$incoming=sanitize_key($raw['id']??'');
        foreach($all[$type] as $i=>$row){if($incoming&&($row['id']??'')===$incoming){$existing=$row;$index=$i;break;}}
        $item=self::help_clean_item($type,$raw,$existing);if($index>=0)$all[$type][$index]=$item;else$all[$type][]=$item;update_option('bsms_help_content_v1',$all,false);
        return array('ok'=>true,'item'=>$item,'content'=>$all);
    }
    public static function admin_help_content_delete(WP_REST_Request $r){
        if (!self::can_manage_platform()) return self::forbidden();
        $type=sanitize_key($r->get_param('type'));$id=sanitize_key($r['id']);if(!in_array($type,array('troubleshooting','knowledge','channels','suggestions'),true))return new WP_Error('bad_type',__('Invalid help content type', 'bulk-sms-portal'),array('status'=>400));
        $all=self::help_content_all();$all[$type]=array_values(array_filter($all[$type],function($row)use($id){return ($row['id']??'')!==$id;}));update_option('bsms_help_content_v1',$all,false);return array('ok'=>true,'content'=>$all);
    }

}
