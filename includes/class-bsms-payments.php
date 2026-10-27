<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Payments {
    public static function init(){ add_action('rest_api_init', array(__CLASS__, 'routes')); }

    public static function routes(){
        register_rest_route('bsms/v1','/paystack/webhook',array('methods'=>'POST','callback'=>array(__CLASS__,'paystack_webhook'),'permission_callback'=>'__return_true'));
    }

    public static function paystack_webhook(WP_REST_Request $request){
        $secret = (string)get_option('bsms_paystack_secret_key','');
        $signature = (string)$request->get_header('x-paystack-signature');
        if (!$secret || !$signature || !hash_equals(hash_hmac('sha512', $request->get_body(), $secret), $signature)) {
            return new WP_Error('payment_unverified', __('Payment confirmation could not be verified.', 'bulk-sms-portal'), array('status'=>401));
        }
        $body = json_decode($request->get_body(), true);
        if (!is_array($body) || empty($body['data']['reference'])) return new WP_Error('payment_invalid', __('Payment confirmation is incomplete.', 'bulk-sms-portal'), array('status'=>400));
        $reference = sanitize_text_field($body['data']['reference']);
        if (($body['event'] ?? '') !== 'charge.success') return array('ok'=>true,'message'=>__('Payment update received.', 'bulk-sms-portal'));
        return self::confirm_paystack($reference);
    }

    public static function confirm_paystack($reference, $expected_user_id=0){
        $reference = sanitize_text_field((string)$reference);
        if ($reference === '' || strlen($reference)>100) return new WP_Error('payment_invalid', __('Payment reference is not valid.', 'bulk-sms-portal'), array('status'=>400));
        $secret = (string)get_option('bsms_paystack_secret_key','');
        if (!$secret) return new WP_Error('payment_unavailable', __('Payment confirmation is unavailable. Please contact support.', 'bulk-sms-portal'), array('status'=>503));
        $res = wp_remote_get('https://api.paystack.co/transaction/verify/' . rawurlencode($reference), array('headers'=>array('Authorization'=>'Bearer '.$secret), 'timeout'=>25, 'redirection'=>0));
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) return new WP_Error('payment_unavailable', __('Payment could not be confirmed yet. Please try again.', 'bulk-sms-portal'), array('status'=>503));
        $verified = json_decode(wp_remote_retrieve_body($res), true);
        if (empty($verified['status']) || !is_array($verified['data'] ?? null)) return new WP_Error('payment_unavailable', __('Payment could not be confirmed yet. Please try again.', 'bulk-sms-portal'), array('status'=>503));
        $data = $verified['data'];
        if (!hash_equals($reference, (string)($data['reference'] ?? '')) || strtoupper((string)($data['currency'] ?? '')) !== 'NGN') return new WP_Error('payment_mismatch', __('Payment details do not match the request. Please contact support.', 'bulk-sms-portal'), array('status'=>409));
        if (strtolower((string)($data['status'] ?? '')) !== 'success') return new WP_Error('payment_pending', __('Payment has not been confirmed yet.', 'bulk-sms-portal'), array('status'=>409));
        // v3.4.2: a Paystack TEST payment (test card, no real money) never credits
        // a wallet unless the platform is deliberately in payment test mode.
        if (strtolower((string)($data['domain'] ?? 'live')) === 'test' && !intval(get_option('bsms_payment_test_mode', 0))) {
            if (class_exists('BSMS_Security')) BSMS_Security::log('payment_test_refused', 'Paystack test-mode payment was not credited', array('reference'=>$reference), 'payment', 0, intval($expected_user_id));
            return new WP_Error('payment_test_mode', __('This was a Paystack test payment, so no money was received and the wallet was not credited. Use your live Paystack keys.', 'bulk-sms-portal'), array('status'=>409));
        }
        return self::credit_verified('paystack', $reference, intval($data['amount'] ?? 0), $data, $expected_user_id);
    }

    /** Credits a wallet once an online payment is confirmed (used by add-on payment methods too). */
    public static function credit_verified($provider, $reference, $amount_kobo, $verified, $expected_user_id=0){
        global $wpdb;
        $funding = BSMS_DB::table('funding_requests');
        $row = $wpdb->get_row($wpdb->prepare("SELECT id,user_id,amount_kobo,method,status FROM {$wpdb->prefix}bsms_funding_requests WHERE reference=%s LIMIT 1", $reference));
        if (!$row || $row->method !== $provider || intval($row->amount_kobo) <= 0 || intval($row->amount_kobo) !== intval($amount_kobo) || ($expected_user_id && intval($row->user_id) !== intval($expected_user_id))) {
            return new WP_Error('payment_mismatch', __('Payment does not match an account funding request. Please contact support.', 'bulk-sms-portal'), array('status'=>409));
        }
        $metadata = $verified['metadata'] ?? array();
        if (is_object($metadata)) $metadata = (array)$metadata;
        $meta_user_id = is_array($metadata) ? intval($metadata['user_id'] ?? 0) : 0;
        if ($meta_user_id && $meta_user_id !== intval($row->user_id)) return new WP_Error('payment_mismatch', __('Payment account does not match. Please contact support.', 'bulk-sms-portal'), array('status'=>409));
        $credit = BSMS_Wallet::credit_sms($row->user_id, $amount_kobo, $reference, array('provider'=>$provider, 'funding_request_id'=>intval($row->id)));
        if (is_wp_error($credit)) return new WP_Error('payment_credit_pending', __('Payment was confirmed, but the wallet could not be updated. Please contact support.', 'bulk-sms-portal'), array('status'=>503));
        $wpdb->update($funding, array('status'=>'approved','meta_json'=>wp_json_encode(array('provider'=>$provider,'verification'=>'confirmed','reference'=>$reference)), 'updated_at'=>BSMS_Util::now_gmt()), array('id'=>intval($row->id), 'user_id'=>intval($row->user_id)));
        self::log_payment_event($provider, $reference, 'credited', array('amount_kobo'=>intval($amount_kobo)), $row->user_id, $amount_kobo);
        return array('ok'=>true, 'payment_status'=>'success', 'amount_kobo'=>intval($amount_kobo), 'message'=>__('Payment confirmed and SMS balance updated.', 'bulk-sms-portal'), 'redirect_url'=>BSMS_Util::payment_return_url($provider,'success',$reference));
    }

    public static function log_payment_event($provider, $reference, $status, $payload=array(), $user_id=0, $amount_kobo=0){
        global $wpdb;
        $events = BSMS_DB::table('paystack_events');
        $wpdb->replace($events, array('reference'=>$reference,'event_type'=>$provider,'status'=>$status,'raw_payload'=>wp_json_encode(array('amount_kobo'=>intval($amount_kobo),'reference'=>$reference)), 'created_at'=>BSMS_Util::now_gmt()));
        if (class_exists('BSMS_Security')) BSMS_Security::log('payment_'.$status, 'Payment update: '.$provider, array('reference'=>$reference,'amount_kobo'=>intval($amount_kobo)), 'payment', 0, intval($user_id));
    }
}
