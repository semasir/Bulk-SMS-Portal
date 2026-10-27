<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Stage 3 capability and data-scope authority.
 *
 * Authorization answers "may this actor perform the action?".
 * Scope answers "which records may this actor see or mutate?".
 * Feature/plan entitlements intentionally remain Stage 4 concerns.
 */
class BSMS_Capabilities {
    const SCOPE_OWN = 'own';
    const SCOPE_PLATFORM = 'platform';

    private static function map(){
        return array(
            'portal'        => 'bsms_access_portal',
            'profile'       => 'bsms_access_portal',
            'compose'       => 'bsms_compose_sms',
            'send'          => 'bsms_send_sms',
            'groups'        => 'bsms_manage_groups',
            'history'       => 'bsms_view_history',
            'reports'       => 'bsms_view_reports',
            'transactions'  => 'bsms_view_transactions',
            'funding'       => 'bsms_buy_sms',
            'sender_ids'    => 'bsms_manage_sender_ids',
            'notifications' => 'bsms_manage_notifications',
            'api'           => 'bsms_use_api',
            'platform'      => 'bsms_manage_platform',
        );
    }

    public static function can_manage_platform(){
        if (!is_user_logged_in()) return false;

        $uid = get_current_user_id();
        if (function_exists('is_super_admin') && is_super_admin($uid)) return true;
        if (current_user_can('manage_options') || current_user_can('bsms_manage_platform')) return true;

        // Keep platform scope canonical even when a role/capability migration or
        // managed WordPress environment has temporarily lost the custom cap.
        // v3.4.1: an account whose email matched the site's "Administration Email
        // Address" used to be treated as a platform admin. Registration does not
        // verify email addresses, so anyone could claim that address. Removed.
        $user = wp_get_current_user();
        return $user && in_array('administrator', (array)$user->roles, true);
    }

    public static function can($action){
        $action = sanitize_key((string)$action);
        if (self::can_manage_platform()) return true;
        if (!is_user_logged_in()) return false;

        $map = self::map();
        if (!isset($map[$action])) return false;
        if ($action === 'platform') return false;
        // v3.6.1: customers may connect their own website or app (API keys),
        // as the published API page promises. Whether each customer may do so
        // is the "API (connect a website or app)" switch (api_access), which
        // BSMS_REST::can_action() checks through the entitlements.
        if ($action === 'api') {
            if ((string)get_user_meta(get_current_user_id(), 'bsms_account_status', true) === 'suspended') return false;
            return current_user_can('bsms_access_portal') || current_user_can('read');
        }
        return current_user_can($map[$action]);
    }

    public static function scope($action='portal'){
        return self::can_manage_platform() ? self::SCOPE_PLATFORM : self::SCOPE_OWN;
    }




    public static function forbidden($message='You are not permitted to perform this action.'){
        return new WP_REST_Response(array(
            'ok'=>false,
            'error'=>$message,
            'code'=>'bsms_forbidden'
        ), 403);
    }

    public static function matrix(){
        $map = self::map();
        $out = array();
        foreach ($map as $action=>$cap) {
            $out[$action] = array(
                'capability'=>$cap,
                'allowed'=>self::can($action),
                'scope'=>self::scope($action),
            );
        }
        return $out;
    }
}
