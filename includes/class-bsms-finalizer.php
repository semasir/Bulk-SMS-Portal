<?php
if (!defined('ABSPATH')) exit;
class BSMS_Finalizer {
    public static function init(){
        add_action('rest_api_init',[__CLASS__,'routes']);
    }
    public static function routes(){
        register_rest_route('bsms/v1','/final-health',[
            'methods'=>'GET',
            'callback'=>[__CLASS__,'final_health'],
            'permission_callback'=>function(){ return class_exists('BSMS_Capabilities') && BSMS_Capabilities::can_manage_platform(); }
        ]);
    }
    public static function final_health(){
        return ['ok'=>true,'version'=>'1.8.8','status'=>__('Enterprise harmonised build active', 'bulk-sms-portal')];
    }
}
