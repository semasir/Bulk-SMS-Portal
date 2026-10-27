<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

/**
 * v3.4.1 canonical funding-request service.
 *
 * Both the portal admin (REST) and the WordPress admin screen call these
 * methods, so approval rules, wallet references, logging and customer
 * notifications are identical everywhere.
 *
 * Rules:
 * - Bank transfers (manual) are approved or rejected by an admin.
 * - Online payments (Paystack, Flutterwave…) are never approved by hand. They
 *   are credited only after the payment provider confirms them, either by the
 *   webhook or by an admin pressing "Check payment". This removes the old path
 *   where an admin approval and the webhook could both credit one payment.
 * - Status changes are atomic (UPDATE … WHERE status=…), so two admins clicking
 *   at the same time cannot both credit a request.
 */
class BSMS_Funding {
    const STATUS_AWAITING_PAYMENT = 'awaiting_payment';

    public static function online_methods(){
        return array('paystack', 'flutterwave', 'paypal', 'woocommerce');
    }

    public static function is_online($row){
        return in_array(strtolower((string)($row->method ?? '')), self::online_methods(), true);
    }

    public static function get($id){
        global $wpdb;
        $t = BSMS_DB::table('funding_requests');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_funding_requests WHERE id=%d", absint($id)));
    }

    /** What an admin may do with this request, used by both admin screens. */
    public static function actions($row){
        $status = strtolower((string)($row->status ?? ''));
        $online = self::is_online($row);
        return array(
            'can_review' => !$online && $status === 'pending',
            'can_verify' => $online && in_array($status, array(self::STATUS_AWAITING_PAYMENT, 'pending'), true),
            'kind' => $online ? 'online' : 'bank_transfer',
        );
    }

    public static function status_label($status){
        $map = array(
            'pending' => __('Waiting for review', 'bulk-sms-portal'),
            self::STATUS_AWAITING_PAYMENT => __('Payment not completed', 'bulk-sms-portal'),
            'approved' => __('Approved', 'bulk-sms-portal'),
            'rejected' => __('Rejected', 'bulk-sms-portal'),
            'processing' => __('Processing', 'bulk-sms-portal'),
        );
        $status = strtolower((string)$status);
        return $map[$status] ?? ucwords(str_replace('_', ' ', $status));
    }

    /** Move a request from one status to another only if it is still in $from. */
    private static function transition($id, $from, $to, $note = null){
        global $wpdb;
        $t = BSMS_DB::table('funding_requests');
        $data = array('status' => $to, 'updated_at' => BSMS_Util::now_gmt());
        if ($note !== null) $data['admin_note'] = $note;
        $where = array('id' => absint($id), 'status' => $from);
        $updated = $wpdb->update($t, $data, $where);
        return intval($updated) === 1;
    }

    public static function approve($id, $admin_note = '', $source = 'portal'){
        $row = self::get($id);
        if (!$row) return new WP_Error('funding_not_found', __('Funding request not found.', 'bulk-sms-portal'), array('status' => 404));
        if (self::is_online($row)) {
            return new WP_Error('funding_online', __('This is an online payment. It is credited automatically when the payment provider confirms it. Use "Check payment" instead.', 'bulk-sms-portal'), array('status' => 409));
        }
        if ($row->status !== 'pending') {
            return new WP_Error('funding_processed', __('This funding request has already been processed.', 'bulk-sms-portal'), array('status' => 409));
        }
        $admin_note = sanitize_textarea_field((string)$admin_note);
        // Claim the request first so a second click or second admin cannot credit it again.
        if (!self::transition($row->id, 'pending', 'processing')) {
            return new WP_Error('funding_processed', __('This funding request has already been processed.', 'bulk-sms-portal'), array('status' => 409));
        }
        $credit = BSMS_Wallet::credit_sms($row->user_id, intval($row->amount_kobo), 'FUND-APPROVED-' . $row->reference, array(
            'funding_request_id' => intval($row->id),
            'admin' => get_current_user_id(),
            'admin_note' => $admin_note,
            'source' => $source,
        ));
        if (is_wp_error($credit)) {
            self::transition($row->id, 'processing', 'pending');
            return new WP_Error($credit->get_error_code(), $credit->get_error_message(), array('status' => 400));
        }
        self::transition($row->id, 'processing', 'approved', $admin_note !== '' ? $admin_note : sprintf(/* translators: %s: a value filled in when shown */ __('Approved by %s', 'bulk-sms-portal'), self::admin_name()));
        if (class_exists('BSMS_Security')) BSMS_Security::log('manual_funding_approved', 'Bank transfer approved', array('funding_request_id' => intval($row->id), 'reference' => $row->reference, 'amount_kobo' => intval($row->amount_kobo), 'source' => $source), 'funding_request', intval($row->id), intval($row->user_id));
        if (class_exists('BSMS_Notifications')) BSMS_Notifications::funding_decision(intval($row->id), intval($row->user_id), intval($row->amount_kobo), 'approved', $admin_note);
        return array('ok' => true, 'message' => __('Bank transfer approved and wallet credited.', 'bulk-sms-portal'));
    }

    public static function reject($id, $admin_note = '', $source = 'portal'){
        $row = self::get($id);
        if (!$row) return new WP_Error('funding_not_found', __('Funding request not found.', 'bulk-sms-portal'), array('status' => 404));
        if (self::is_online($row)) {
            return new WP_Error('funding_online', __('Online payments cannot be rejected by hand. If the customer paid, the payment provider will confirm it.', 'bulk-sms-portal'), array('status' => 409));
        }
        $admin_note = sanitize_textarea_field((string)$admin_note);
        if (!self::transition($row->id, 'pending', 'rejected', $admin_note !== '' ? $admin_note : sprintf(/* translators: %s: a value filled in when shown */ __('Rejected by %s', 'bulk-sms-portal'), self::admin_name()))) {
            return new WP_Error('funding_processed', __('This funding request has already been processed.', 'bulk-sms-portal'), array('status' => 409));
        }
        if (class_exists('BSMS_Security')) BSMS_Security::log('manual_funding_rejected', 'Bank transfer rejected', array('funding_request_id' => intval($row->id), 'reference' => $row->reference, 'source' => $source), 'funding_request', intval($row->id), intval($row->user_id));
        if (class_exists('BSMS_Notifications')) BSMS_Notifications::funding_decision(intval($row->id), intval($row->user_id), intval($row->amount_kobo), 'rejected', $admin_note);
        return array('ok' => true, 'message' => __('Funding request rejected.', 'bulk-sms-portal'));
    }

    /** Ask the payment provider whether an online payment was completed, and credit it if so. */
    public static function verify($id){
        $row = self::get($id);
        if (!$row) return new WP_Error('funding_not_found', __('Funding request not found.', 'bulk-sms-portal'), array('status' => 404));
        if (!self::is_online($row)) return new WP_Error('funding_manual', __('This is a bank transfer. Approve or reject it after checking your bank account.', 'bulk-sms-portal'), array('status' => 409));
        if ($row->status === 'approved') return array('ok' => true, 'message' => __('This payment was already confirmed and credited.', 'bulk-sms-portal'));
        if ($row->method !== 'paystack') {
            return new WP_Error('funding_verify_unavailable', __('Automatic checking is only available for Paystack payments.', 'bulk-sms-portal'), array('status' => 409));
        }
        $result = BSMS_Payments::confirm_paystack($row->reference, intval($row->user_id));
        if (is_wp_error($result)) {
            $code = $result->get_error_code();
            $message = $code === 'payment_pending' ? __('Paystack says this payment has not been completed. Nothing was credited.', 'bulk-sms-portal') : $result->get_error_message();
            return new WP_Error($code, $message, array('status' => 409));
        }
        return array('ok' => true, 'message' => __('Paystack confirmed the payment. The wallet has been credited.', 'bulk-sms-portal'));
    }

    /** One-time upgrade: online payments that were never completed leave the bank-transfer review queue. */
    public static function migrate(){
        global $wpdb;
        $t = BSMS_DB::table('funding_requests');
        $methods = self::online_methods();
        $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}bsms_funding_requests SET status=%s WHERE status='pending' AND method IN (" . implode(',', array_fill(0, count($methods), '%s')) . ")", array_merge(array(self::STATUS_AWAITING_PAYMENT), $methods)));
    }

    /**
     * Funding requests that may have been credited twice by the pre-3.4.1
     * approval path (an admin approval plus a provider confirmation).
     */
    public static function possible_double_credits(){
        global $wpdb;
        $t = BSMS_DB::table('funding_requests');
        $l = BSMS_DB::table('ledger');
        return $wpdb->get_results("SELECT f.id, f.user_id, f.reference, f.amount_kobo, f.method
            FROM {$wpdb->prefix}bsms_funding_requests f
            INNER JOIN {$wpdb->prefix}bsms_ledger a ON a.reference=CONCAT('FUND-APPROVED-', f.reference)
            INNER JOIN {$wpdb->prefix}bsms_ledger p ON p.reference=f.reference
            WHERE f.method IN ('paystack','flutterwave')
            ORDER BY f.id DESC LIMIT 200");
    }

    private static function admin_name(){
        $u = wp_get_current_user();
        return ($u && $u->ID) ? ($u->display_name ?: $u->user_login) : 'admin';
    }
}
