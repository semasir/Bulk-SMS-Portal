<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

/**
 * Stage 4 — Feature & Entitlement Engine.
 *
 * Capability (Stage 3) answers WHO may act.
 * Entitlement (Stage 4) answers WHAT the account/package includes.
 *
 * Existing installations remain unrestricted by default: all established
 * customer features are enabled and numeric limits are unlimited (0).
 */
class BSMS_Entitlements {

    public static function feature_registry(){
        $registry = array(
            'compose_sms'       => array('label'=>__('Compose SMS', 'bulk-sms-portal'),'default'=>1,'depends'=>array()),
            'scheduled_sms'     => array('label'=>__('Scheduled SMS', 'bulk-sms-portal'),'default'=>1,'depends'=>array('compose_sms')),
            'templates'         => array('label'=>__('Message Templates', 'bulk-sms-portal'),'default'=>1,'depends'=>array('compose_sms')),
            'phone_groups'      => array('label'=>__('Phonebook / Groups', 'bulk-sms-portal'),'default'=>1,'depends'=>array()),
            'message_history'   => array('label'=>__('Message History', 'bulk-sms-portal'),'default'=>1,'depends'=>array()),
            'delivery_reports'  => array('label'=>__('Delivery Reports', 'bulk-sms-portal'),'default'=>1,'depends'=>array('message_history')),
            'buy_sms'           => array('label'=>__('Buy SMS / Funding', 'bulk-sms-portal'),'default'=>1,'depends'=>array()),
            'manual_funding'    => array('label'=>__('Manual Funding', 'bulk-sms-portal'),'default'=>1,'depends'=>array('buy_sms')),
            'transactions'      => array('label'=>__('Transactions', 'bulk-sms-portal'),'default'=>1,'depends'=>array()),
            'sender_ids'        => array('label'=>__('Sender IDs', 'bulk-sms-portal'),'default'=>1,'depends'=>array()),
            'notifications'     => array('label'=>__('Notifications', 'bulk-sms-portal'),'default'=>1,'depends'=>array()),
            'api_access'        => array('label'=>__('API Access', 'bulk-sms-portal'),'default'=>1,'depends'=>array('compose_sms')),
        );
        return apply_filters('bsms_entitlement_feature_registry', $registry);
    }

    public static function limit_registry(){
        $registry = array(
            'phone_groups'            => array('label'=>__('Phone groups', 'bulk-sms-portal'),'default'=>0),
            'contacts_per_group'      => array('label'=>__('Contacts per group', 'bulk-sms-portal'),'default'=>0),
            'templates'               => array('label'=>__('Message templates', 'bulk-sms-portal'),'default'=>0),
            'sender_ids'              => array('label'=>__('Sender ID requests', 'bulk-sms-portal'),'default'=>0),
            'campaigns_per_day'       => array('label'=>__('Campaigns per day', 'bulk-sms-portal'),'default'=>0),
            'recipients_per_campaign' => array('label'=>__('Recipients per campaign', 'bulk-sms-portal'),'default'=>0),
            'api_keys'                => array('label'=>__('API keys', 'bulk-sms-portal'),'default'=>0),
        );
        return apply_filters('bsms_entitlement_limit_registry', $registry);
    }

    public static function plan_registry(){
        // Deliberately neutral. Commercial editions can be registered later
        // by Stage 6 add-ons without changing the core entitlement engine.
        $plans = array(
            'standard' => array(
                'label'=>__('Standard', 'bulk-sms-portal'),
                'features'=>array(),
                'limits'=>array(),
            ),
        );
        return apply_filters('bsms_entitlement_plans', $plans);
    }

    public static function platform_feature_enabled($feature){
        $feature = sanitize_key((string)$feature);
        $registry = self::feature_registry();
        if (!isset($registry[$feature])) return true;

        $legacy = array(
            'compose_sms'=>'bsms_feature_compose_sms',
            'phone_groups'=>'bsms_feature_phone_groups',
            'message_history'=>'bsms_feature_message_history',
            'delivery_reports'=>'bsms_feature_delivery_reports',
            'buy_sms'=>'bsms_feature_buy_sms',
            'manual_funding'=>'bsms_feature_manual_funding',
            'transactions'=>'bsms_feature_transactions',
            'sender_ids'=>'bsms_feature_sender_ids',
            'api_access'=>'bsms_feature_api_access',
        );
        if (isset($legacy[$feature])) {
            return get_option($legacy[$feature], (string)intval($registry[$feature]['default'])) === '1';
        }
        return get_option('bsms_entitlement_feature_'.$feature, (string)intval($registry[$feature]['default'])) === '1';
    }

    public static function platform_limit($key){
        $key = sanitize_key((string)$key);
        $registry = self::limit_registry();
        if (!isset($registry[$key])) return 0;
        return max(0, intval(get_option('bsms_entitlement_limit_'.$key, intval($registry[$key]['default']))));
    }

    /** Per-customer exceptions (added by add-ons through the bsms_user_entitlement_overrides filter). */
    public static function user_overrides($user_id=0){
        $uid = $user_id ? intval($user_id) : get_current_user_id();
        $data = $uid ? apply_filters('bsms_user_entitlement_overrides', array('features'=>array(),'limits'=>array()), $uid) : array();
        return array(
            'features'=>isset($data['features']) && is_array($data['features']) ? $data['features'] : array(),
            'limits'=>isset($data['limits']) && is_array($data['limits']) ? $data['limits'] : array(),
        );
    }

    public static function plan_key($user_id=0){
        $uid = $user_id ? intval($user_id) : get_current_user_id();
        $key = $uid ? sanitize_key((string)apply_filters('bsms_user_plan_key', 'standard', $uid)) : 'standard';
        $plans = self::plan_registry();
        return isset($plans[$key]) ? $key : 'standard';
    }

    public static function is_enabled($feature, $user_id=0){
        $feature = sanitize_key((string)$feature);
        $uid = $user_id ? intval($user_id) : get_current_user_id();
        $registry = self::feature_registry();
        if (!isset($registry[$feature])) return true;

        // Platform managers must always be able to administer/recover the product.
        if ($uid && class_exists('BSMS_Capabilities') && BSMS_Capabilities::can_manage_platform() && $uid === get_current_user_id()) {
            return true;
        }

        if (!self::platform_feature_enabled($feature)) return false;

        $plans = self::plan_registry();
        $plan = $plans[self::plan_key($uid)] ?? array();
        $enabled = isset($registry[$feature]['default']) ? !empty($registry[$feature]['default']) : true;
        if (isset($plan['features'][$feature])) $enabled = !empty($plan['features'][$feature]);

        $overrides = self::user_overrides($uid);
        if (array_key_exists($feature, $overrides['features']) && $overrides['features'][$feature] !== '' && $overrides['features'][$feature] !== null) {
            $enabled = !empty($overrides['features'][$feature]);
        }

        if ($enabled && !empty($registry[$feature]['depends'])) {
            foreach ((array)$registry[$feature]['depends'] as $dependency) {
                if ($dependency === $feature) continue;
                if (!self::is_enabled($dependency, $uid)) { $enabled = false; break; }
            }
        }

        return (bool)apply_filters('bsms_entitlement_feature_enabled', $enabled, $feature, $uid);
    }

    public static function limit($key, $user_id=0){
        $key = sanitize_key((string)$key);
        $uid = $user_id ? intval($user_id) : get_current_user_id();
        $registry = self::limit_registry();
        if (!isset($registry[$key])) return 0;

        if ($uid && class_exists('BSMS_Capabilities') && BSMS_Capabilities::can_manage_platform() && $uid === get_current_user_id()) {
            return 0;
        }

        $value = self::platform_limit($key);
        $plans = self::plan_registry();
        $plan = $plans[self::plan_key($uid)] ?? array();
        if (isset($plan['limits'][$key])) $value = max(0, intval($plan['limits'][$key]));

        $overrides = self::user_overrides($uid);
        if (array_key_exists($key, $overrides['limits']) && $overrides['limits'][$key] !== '' && $overrides['limits'][$key] !== null) {
            $value = max(0, intval($overrides['limits'][$key]));
        }

        return max(0, intval(apply_filters('bsms_entitlement_limit', $value, $key, $uid)));
    }

    public static function usage($key, $user_id=0, $context=array()){
        global $wpdb;
        $uid = $user_id ? intval($user_id) : get_current_user_id();
        $key = sanitize_key((string)$key);
        if (!$uid) return 0;

        if ($key === 'phone_groups') {
            return intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_phone_groups WHERE user_id=%d", $uid)));
        }
        if ($key === 'contacts_per_group') {
            $gid = intval($context['group_id'] ?? 0);
            if (!$gid) return 0;
            return intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_phone_group_numbers WHERE user_id=%d AND group_id=%d", $uid, $gid)));
        }
        if ($key === 'templates') {
            return intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_templates WHERE user_id=%d", $uid)));
        }
        if ($key === 'sender_ids') {
            return intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_sender_ids WHERE user_id=%d AND status<>'rejected'", $uid)));
        }
        if ($key === 'campaigns_per_day') {
            $from = gmdate('Y-m-d 00:00:00');
            return intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_campaigns WHERE user_id=%d AND created_at>=%s", $uid, $from)));
        }
        if ($key === 'api_keys') {
            return intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_api_keys WHERE user_id=%d AND status=%s", $uid, 'active')));
        }
        if ($key === 'recipients_per_campaign') {
            return max(0, intval($context['recipients'] ?? 0));
        }
        return intval(apply_filters('bsms_entitlement_usage', 0, $key, $uid, $context));
    }

    public static function check_limit($key, $increment=1, $user_id=0, $context=array(), $replace=false){
        $uid = $user_id ? intval($user_id) : get_current_user_id();
        $limit = self::limit($key, $uid);
        if ($limit <= 0) return array('allowed'=>true,'limit'=>0,'used'=>self::usage($key,$uid,$context),'remaining'=>null);

        $used = self::usage($key, $uid, $context);
        $projected = $replace ? max(0, intval($increment)) : ($used + max(0, intval($increment)));
        $allowed = $projected <= $limit;
        return array(
            'allowed'=>$allowed,
            'limit'=>$limit,
            'used'=>$used,
            'projected'=>$projected,
            'remaining'=>max(0, $limit-$used),
        );
    }

    public static function enforce_limit($key, $increment=1, $user_id=0, $context=array(), $replace=false){
        $check = self::check_limit($key,$increment,$user_id,$context,$replace);
        if (!empty($check['allowed'])) return true;
        $registry = self::limit_registry();
        $label = $registry[$key]['label'] ?? ucwords(str_replace('_',' ',$key));
        return new WP_Error(
            'bsms_entitlement_limit_'.$key,
            sprintf(/* translators: %1$s, %2$d: values filled in when shown */ __('%1$s limit reached. Your account limit is %2$d.', 'bulk-sms-portal'), $label, intval($check['limit'])),
            array('status'=>403,'entitlement'=>$key,'limit'=>$check['limit'],'used'=>$check['used'],'remaining'=>$check['remaining'])
        );
    }

    public static function action_feature($action){
        $map = array(
            'compose'=>'compose_sms',
            'send'=>'compose_sms',
            'groups'=>'phone_groups',
            'history'=>'message_history',
            'reports'=>'delivery_reports',
            'transactions'=>'transactions',
            'funding'=>'buy_sms',
            'sender_ids'=>'sender_ids',
            'notifications'=>'notifications',
            'api'=>'api_access',
        );
        $action = sanitize_key((string)$action);
        return $map[$action] ?? '';
    }

    public static function allows_action($action, $user_id=0){
        $feature = self::action_feature($action);
        return !$feature || self::is_enabled($feature, $user_id);
    }


    public static function matrix($user_id=0){
        $uid = $user_id ? intval($user_id) : get_current_user_id();
        $features=array(); foreach(self::feature_registry() as $key=>$def){
            $features[$key]=array('label'=>$def['label'],'enabled'=>self::is_enabled($key,$uid),'depends'=>$def['depends'] ?? array());
        }
        $limits=array(); foreach(self::limit_registry() as $key=>$def){
            $limit=self::limit($key,$uid); $limits[$key]=array('label'=>$def['label'],'limit'=>$limit,'unlimited'=>$limit<=0);
        }
        return array('plan'=>self::plan_key($uid),'features'=>$features,'limits'=>$limits);
    }
}
