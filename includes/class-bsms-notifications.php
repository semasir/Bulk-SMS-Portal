<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Notifications {
    public static function mail_from_name($name=''){
        // v3.7.1: the brand name from Platform Settings.
        $brand = class_exists('BSMS_Util') ? trim((string)BSMS_Util::brand_name()) : '';
        return $brand !== '' ? $brand : (get_bloginfo('name') ?: __('SMS Portal', 'bulk-sms-portal'));
    }
    public static function mail_from_email($email=''){
        // The address set in Platform Settings, otherwise WordPress's own address.
        $configured = sanitize_email((string)get_option('bsms_transactional_from_email', ''));
        return $configured ?: (string)$email;
    }

    /** Canonical recipient for operational admin alerts, with WordPress admin fallback. */
    public static function admin_notification_email(){
        $configured = sanitize_email((string)get_option('bsms_admin_notification_email', ''));
        if ($configured && is_email($configured)) return $configured;
        $fallback = sanitize_email((string)get_option('admin_email', ''));
        return ($fallback && is_email($fallback)) ? $fallback : '';
    }

    /** Branded HTML layout for all customer and admin email. */
    public static function email_html($subject, $message, $args=array()){
        $brand = self::mail_from_name();
        $logo = class_exists('BSMS_Util') ? BSMS_Util::logo_url() : '';
        $primary = class_exists('BSMS_Util') ? BSMS_Util::primary_color() : '#008000';
        $portal = BSMS_Util::page_url();
        $preheader = sanitize_text_field((string)($args['preheader'] ?? $subject));
        $cta_label = sanitize_text_field((string)($args['cta_label'] ?? ('Open ' . $brand)));
        $cta_url = esc_url((string)($args['cta_url'] ?? $portal));
        $safe_subject = esc_html($subject);
        $body = nl2br(esc_html((string)$message));
        $logo_html = $logo ? '<img src="'.esc_url($logo).'" alt="'.esc_attr($brand).'" style="display:block;max-width:210px;max-height:58px;width:auto;height:auto;border:0">' : '<div style="font-size:24px;font-weight:800;color:#0f172a">'.esc_html($brand).'</div>';
        return '<!doctype html><html><body style="margin:0;padding:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#17221b">'
            .'<div style="display:none;max-height:0;overflow:hidden;opacity:0">'.esc_html($preheader).'</div>'
            .'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f4;padding:28px 12px"><tr><td align="center">'
            .'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dfe8e2;border-radius:18px;overflow:hidden">'
            .'<tr><td style="padding:26px 30px;border-bottom:1px solid #e8eeea">'.$logo_html.'</td></tr>'
            .'<tr><td style="padding:34px 30px 18px"><h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;color:#14231b">'.$safe_subject.'</h1><div style="font-size:16px;line-height:1.7;color:#33443a">'.$body.'</div></td></tr>'
            .'<tr><td style="padding:8px 30px 34px"><a href="'.$cta_url.'" style="display:inline-block;background:'.esc_attr($primary).';color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 20px;border-radius:9px">'.esc_html($cta_label).'</a></td></tr>'
            .('<tr><td style="padding:22px 30px;background:#f8faf8;border-top:1px solid #e8eeea;font-size:13px;line-height:1.6;color:#657269">' . esc_html__('This email was sent by', 'bulk-sms-portal') . ' ').esc_html($brand).'. For account notification preferences, sign in to your portal.<br><a href="'.esc_url($portal).'" style="color:'.esc_attr($primary).';text-decoration:none">'.esc_html($portal).'</a></td></tr>'
            .'</table></td></tr></table></body></html>';
    }

    /** Send plugin-owned mail with one canonical product identity. */
    public static function mail($to, $subject, $message, $headers=array(), $args=array()){
        $headers = is_array($headers) ? $headers : array($headers);
        $headers = array_values(array_filter($headers, static function($h){ return stripos((string)$h, 'Content-Type:') !== 0; }));
        $headers[] = 'Content-Type: text/html; charset=UTF-8';
        $html = self::email_html($subject, $message, $args);
        add_filter('wp_mail_from_name', array(__CLASS__, 'mail_from_name'), 999);
        add_filter('wp_mail_from', array(__CLASS__, 'mail_from_email'), 999);
        try { return wp_mail($to, $subject, $html, $headers); }
        finally {
            remove_filter('wp_mail_from', array(__CLASS__, 'mail_from_email'), 999);
            remove_filter('wp_mail_from_name', array(__CLASS__, 'mail_from_name'), 999);
        }
    }
    public static function defaults(){
        return array(
            'email_credit'=>1,
            'sms_credit'=>0,
            'email_funding'=>1,
            'sms_funding'=>0,
            'email_campaign'=>1,
            'sms_campaign'=>0,
            'email_low_balance'=>1,
            'sms_low_balance'=>0,
            'email_sender_decision'=>1,
            'email_newsletter'=>0,
            'sms_sender_decision'=>0,
            'bill_sms_alerts'=>1,
            'low_balance_units'=>10,
            'phone'=>''
        );
    }

    public static function get_preferences($user_id){
        $prefs = get_user_meta($user_id, 'bsms_notification_prefs', true);
        if (!is_array($prefs)) $prefs = array();
        return array_merge(self::defaults(), $prefs);
    }

    public static function save_preferences($user_id, $prefs){
        $current = self::get_preferences($user_id);
        $allowed = array_keys(self::defaults());
        // v3.5.0: whether SMS alerts are charged is a platform rule, not a
        // customer choice. Only platform admins may change it.
        $can_set_billing = class_exists('BSMS_Capabilities') ? BSMS_Capabilities::can_manage_platform() : current_user_can('manage_options');
        foreach ($allowed as $k) {
            // Only change what was sent, so a partial save never switches
            // other alerts off by accident.
            if (!array_key_exists($k, (array)$prefs)) continue;
            if ($k === 'bill_sms_alerts' && !$can_set_billing) continue;
            if ($k === 'phone') {
                $current[$k] = sanitize_text_field($prefs[$k] ?? $current[$k]);
            } elseif ($k === 'low_balance_units') {
                $current[$k] = max(0, intval($prefs[$k] ?? $current[$k]));
            } else {
                $current[$k] = !empty($prefs[$k]) ? 1 : 0;
            }
        }
        update_user_meta($user_id, 'bsms_notification_prefs', $current);
        if (!empty($current['phone'])) update_user_meta($user_id, 'bsms_phone', $current['phone']);
        if (isset($current['low_balance_units'])) update_user_meta($user_id, 'bsms_low_balance_units', intval($current['low_balance_units']));
        return $current;
    }

    /** Friendly account name used for customer-facing greetings. */
    public static function user_name($user_id){
        $user = get_user_by('id', absint($user_id));
        if (!$user) return __('Customer', 'bulk-sms-portal');
        $name = trim((string)$user->display_name);
        if ($name === '') $name = trim((string)$user->user_login);
        return $name !== '' ? $name : __('Customer', 'bulk-sms-portal');
    }

    /** Prefix customer email content once with the canonical salutation. */
    public static function personalised_email_message($user_id, $message){
        $message = ltrim((string)$message);
        if (preg_match('/^(dear|hello|hi)\s+/i', $message)) return $message;
        return sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Dear %1$s,

%2$s', 'bulk-sms-portal'), self::user_name($user_id), $message);
    }

    /**
     * Keep account SMS alerts GSM-friendly and within one 160-character segment.
     * The portal/email can retain the naira glyph; SMS uses NGN because the naira
     * sign is not reliably represented by SMS gateways/handsets.
     */
    public static function sms_message($user_id, $message){
        $message = str_replace(array('₦', "\r", "\n", "\t"), array('NGN', ' ', ' ', ' '), (string)$message);
        $message = preg_replace('/\s+/', ' ', trim($message));
        if (!preg_match('/^(dear|hello|hi)\s+/i', $message)) {
            $message = sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Dear %1$s, %2$s', 'bulk-sms-portal'), self::user_name($user_id), $message);
        }
        // A single transactional alert should remain one SMS. Preserve meaning
        // and trim only unusually long dynamic data such as references/notes.
        $len = function_exists('mb_strlen') ? mb_strlen($message, 'UTF-8') : strlen($message);
        if ($len > 160) {
            $message = function_exists('mb_substr') ? mb_substr($message, 0, 157, 'UTF-8') . '...' : substr($message, 0, 157) . '...';
        }
        return $message;
    }

    public static function user_phone($user_id){
        $prefs = self::get_preferences($user_id);
        if (!empty($prefs['phone'])) return $prefs['phone'];
        foreach (array('bsms_phone','billing_phone','phone','user_phone') as $key) {
            $v = trim((string)get_user_meta($user_id, $key, true));
            if ($v !== '') return $v;
        }
        return '';
    }

    public static function notify($user_id, $type, $subject, $message, $meta=array()){
        $prefs = self::get_preferences($user_id);
        $email_key = 'email_' . $type;
        $sms_key = 'sms_' . $type;

        $sent = array('email'=>false, 'sms'=>false);

        if (!empty($prefs[$email_key])) {
            $sent['email'] = self::send_email($user_id, $type, $subject, $message, $meta);
        }

        if (!empty($prefs[$sms_key])) {
            $sent['sms'] = self::send_sms_alert($user_id, $type, $message, !empty($prefs['bill_sms_alerts']), $meta);
        }

        return $sent;
    }

    public static function send_email($user_id, $type, $subject, $message, $meta=array()){
        $user = get_user_by('id', $user_id);
        if (!$user || !$user->user_email) return false;
        $key = sanitize_key((string)($meta['idempotency_key'] ?? ''));
        if ($key && get_user_meta($user_id, 'bsms_email_once_'.$key, true)) return true;
        $mail_args = array(
            'preheader'=>(string)($meta['preheader'] ?? $subject),
            'cta_label'=>(string)($meta['cta_label'] ?? (sprintf(/* translators: %s: a value filled in when shown */ __('Open %s', 'bulk-sms-portal'), self::mail_from_name()))),
            'cta_url'=>(string)($meta['cta_url'] ?? BSMS_Util::page_url()),
        );
        $email_message = self::personalised_email_message($user_id, $message);
        $ok = self::mail($user->user_email, $subject, $email_message, array(), $mail_args);
        self::log($user_id, $type, 'email', $subject, $email_message, $ok ? 'sent' : 'failed', 0, '', $meta);
        if ($ok && $key) update_user_meta($user_id, 'bsms_email_once_'.$key, BSMS_Util::now_gmt());
        return $ok;
    }

    public static function send_sms_alert($user_id, $type, $message, $bill=true, $meta=array()){
        $message = self::sms_message($user_id, $message);
        $raw = self::user_phone($user_id);
        if (!$raw) {
            self::log($user_id, $type, 'sms', '', $message, 'failed', 0, '', array('reason'=>'missing_phone') + $meta);
            return false;
        }

        $phone = BSMS_Util::normalize_phone_e164($raw, BSMS_Util::default_country($user_id));
        if (!$phone) {
            self::log($user_id, $type, 'sms', '', $message, 'failed', 0, '', array('reason'=>'invalid_phone') + $meta);
            return false;
        }

        $unit = BSMS_Pricing::unit_price_kobo($phone, 'standard');
        if ($unit === null) {
            self::log($user_id, $type, 'sms', '', $message, 'failed', 0, '', array('reason'=>'no_rate_for_country') + $meta);
            return false;
        }
        $cost = BSMS_Pricing::customer_price_kobo($unit, $user_id) * max(1, BSMS_Util::sms_pages($message));
        $ref = 'ALERT-' . $user_id . '-' . time() . '-' . wp_generate_password(5,false,false);

        if ($bill) {
            // Account-generated SMS alerts may use the tightly controlled
            // notification overdraft; normal customer sends cannot.
            $debit = BSMS_Wallet::debit_notification_sms(
                $user_id,
                $cost,
                $ref,
                array('notification_type'=>$type, 'notification_message'=>$message) + $meta
            );
            if (is_wp_error($debit)) {
                self::log($user_id, $type, 'sms', '', $message, 'failed', 0, $ref, array('reason'=>$debit->get_error_message(), 'code'=>$debit->get_error_code()) + $meta);
                return false;
            }
        } else {
            $cost = 0;
        }

        $sender = BSMS_Util::shared_sender();
        $send = BSMS_Providers::send_sms($phone, $message, $sender, 'standard', array('notification'=>true, 'type'=>$type));
        if (is_wp_error($send)) {
            if ($bill && $cost > 0) {
                BSMS_Wallet::refund_notification_sms($user_id, $cost, $ref, array('notification_type'=>$type, 'provider_error'=>$send->get_error_message()) + $meta);
            }
            self::log($user_id, $type, 'sms', '', $message, 'failed', 0, $ref, array('reason'=>$send->get_error_message()) + $meta);
            return false;
        }

        self::log($user_id, $type, 'sms', '', $message, 'sent', $cost, $ref, $meta + array('provider_message_id'=>$send['provider_message_id'] ?? ''));
        return true;
    }


    public static function admin_funding_submission($request_id, $user_id, $amount_kobo, $reference='', $depositor='', $bank=''){
        $user = get_user_by('id', intval($user_id));
        $admin_email = self::admin_notification_email();
        if (!$user || !$admin_email || !is_email($admin_email)) return false;
        $brand = BSMS_Util::brand_name();
        $subject = '[' . $brand . __('] New funding request #', 'bulk-sms-portal') . intval($request_id);
        $url = BSMS_Util::page_url('admin-users');
        $body = __("A new manual funding request requires review.\n\n", 'bulk-sms-portal');
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Customer: %s
', 'bulk-sms-portal'), ($user->display_name ?: $user->user_login));
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Email: %s
', 'bulk-sms-portal'), $user->user_email);
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Amount: %s
', 'bulk-sms-portal'), BSMS_Util::money(intval($amount_kobo)));
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Reference: %s
', 'bulk-sms-portal'), sanitize_text_field($reference));
        if (trim((string)$depositor) !== '') $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Depositor: %s
', 'bulk-sms-portal'), sanitize_text_field($depositor));
        if (trim((string)$bank) !== '') $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Bank: %s
', 'bulk-sms-portal'), sanitize_text_field($bank));
        $body .= __("Proof of payment: uploaded and available in Platform Admin → Funding Requests.\n", 'bulk-sms-portal');
        $body .= sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Submitted: %1$s UTC

Review: %2$s', 'bulk-sms-portal'), BSMS_Util::now_gmt(), $url);
        return self::mail($admin_email, $subject, $body);
    }

    public static function funding_decision($request_id, $user_id, $amount_kobo, $status, $admin_note=''){
        $approved = strtolower((string)$status) === 'approved';
        $subject = $approved ? __('Your wallet funding has been approved', 'bulk-sms-portal') : __('Update on your wallet funding request', 'bulk-sms-portal');
        $message = $approved
            ? sprintf(/* translators: %s: a value filled in when shown */ __('Your funding request of %s has been approved and credited to your SMS Wallet.', 'bulk-sms-portal'), BSMS_Util::money(intval($amount_kobo)))
            : sprintf(/* translators: %s: a value filled in when shown */ __('Your funding request of %s was not approved.', 'bulk-sms-portal'), BSMS_Util::money(intval($amount_kobo)));
        $reason = trim((string)$admin_note);
        if (!$approved && $reason !== '') $message .= sprintf(/* translators: %s: a value filled in when shown */ __(' Reason: %s', 'bulk-sms-portal'), $reason);
        return self::send_email(intval($user_id), 'funding', $subject, $message, array('funding_request_id'=>intval($request_id),'status'=>$approved?'approved':'rejected'));
    }

    public static function admin_sender_submission($request_id, $user_id, $sender_id, $sample_message=''){
        $user = get_user_by('id', intval($user_id));
        $admin_email = self::admin_notification_email();
        if (!$user || !$admin_email || !is_email($admin_email)) return false;

        $brand = BSMS_Util::brand_name();
        $subject = '[' . $brand . __('] New Sender ID request: ', 'bulk-sms-portal') . $sender_id;
        $portal_url = BSMS_Util::page_url('admin-senders');
        $body = __("A new Sender ID request has been submitted.\n\n", 'bulk-sms-portal');
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Customer: %s
', 'bulk-sms-portal'), ($user->display_name ?: $user->user_login));
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Email: %s
', 'bulk-sms-portal'), $user->user_email);
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Sender ID: %s
', 'bulk-sms-portal'), $sender_id);
        if (trim((string)$sample_message) !== '') $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Sample message: %s
', 'bulk-sms-portal'), trim((string)$sample_message));
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Request ID: #%s
', 'bulk-sms-portal'), intval($request_id));
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Submitted: %s UTC

', 'bulk-sms-portal'), BSMS_Util::now_gmt());
        $body .= sprintf(/* translators: %s: a value filled in when shown */ __('Review this request in Platform Admin → Sender ID Manager:
%s', 'bulk-sms-portal'), $portal_url);

        $once_key = 'bsms_sender_submission_admin_notified_' . intval($request_id);
        if (get_option($once_key, '')) return true;
        $ok = self::mail($admin_email, $subject, $body, array(), array('preheader'=>__('A Sender ID is waiting for review', 'bulk-sms-portal'),'cta_label'=>__('Review Sender ID', 'bulk-sms-portal'),'cta_url'=>$portal_url));
        if ($ok) update_option($once_key, BSMS_Util::now_gmt(), false);
        return $ok;
    }

    public static function sender_decision($request_id, $user_id, $sender_id, $status, $admin_note=''){
        $user_id = intval($user_id);
        $user = get_user_by('id', $user_id);
        if (!$user) return array('email'=>false,'sms'=>false);

        $status = strtolower((string)$status) === 'approved' ? 'approved' : 'rejected';
        $brand = BSMS_Util::brand_name();
        $approved = $status === 'approved';
        $subject = $approved ? __('Your Sender ID has been approved', 'bulk-sms-portal') : __('Update on your Sender ID request', 'bulk-sms-portal');
        $message = $approved
            ? "Your Sender ID \"{$sender_id}\" has been approved and is ready to use on {$brand}."
            : "Your Sender ID \"{$sender_id}\" was not approved on {$brand}.";

        $clean_note = trim((string)$admin_note);
        if (!$approved && $clean_note !== '') {
            $reason = $clean_note;
            if (stripos($reason, 'Reason:') !== false) {
                $parts = preg_split('/Reason:\s*/i', $reason, 2);
                $reason = trim((string)end($parts));
            }
            if ($reason !== '') $message .= sprintf(/* translators: %s: a value filled in when shown */ __(' Reason: %s', 'bulk-sms-portal'), $reason);
        }

        // Sender ID decisions are important transactional emails and are
        // always emailed to the account address.
        $email_ok = self::send_email(
            $user_id,
            'sender_decision',
            $subject,
            $message,
            array('sender_request_id'=>intval($request_id),'sender_id'=>$sender_id,'status'=>$status,'idempotency_key'=>'sender_decision_'.intval($request_id).'_'.$status,'preheader'=>$subject,'cta_label'=>__('Open Sender IDs', 'bulk-sms-portal'),'cta_url'=>BSMS_Util::page_url('sender-id'))
        );

        $prefs = self::get_preferences($user_id);
        $sms_ok = false;
        if (!empty($prefs['sms_sender_decision'])) {
            $sms_text = $approved
                ? "Sender ID {$sender_id} approved on {$brand}. It is now ready to use."
                : "Sender ID {$sender_id} was not approved on {$brand}. Check your account/email for details.";
            $sms_ok = self::send_sms_alert(
                $user_id,
                'sender_decision',
                $sms_text,
                true,
                array('sender_request_id'=>intval($request_id),'sender_id'=>$sender_id,'status'=>$status)
            );
        }

        return array('email'=>$email_ok,'sms'=>$sms_ok);
    }

    public static function maybe_low_balance($user_id){
        $prefs = self::get_preferences($user_id);
        $threshold = intval($prefs['low_balance_units']);
        if ($threshold <= 0) return;

        $units = BSMS_Wallet::estimated_units(BSMS_Wallet::get_balance_kobo($user_id));
        if ($units > $threshold) return;

        $today = gmdate('Y-m-d');
        $last = get_user_meta($user_id, 'bsms_low_balance_notice_date', true);
        if ($last === $today) return;

        update_user_meta($user_id, 'bsms_low_balance_notice_date', $today);
        $brand = BSMS_Util::brand_name();
        self::notify($user_id, 'low_balance', __('Low SMS balance alert', 'bulk-sms-portal'), "Your {$brand} SMS balance is low. Current balance: {$units} units.", array('units'=>$units));
    }

    public static function campaign_summary($user_id, $campaign_id){
        global $wpdb;
        $j = BSMS_DB::table('jobs');
        $rows = $wpdb->get_results($wpdb->prepare("SELECT status_bucket, provider_status, err_code, api_id, sent_at, cost_kobo FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d AND user_id=%d", $campaign_id, $user_id), ARRAY_A);
        if (!$rows) return;
        $summary = array('total'=>count($rows),'accepted'=>0,'delivered'=>0,'pending'=>0,'failed'=>0,'cost'=>0);
        foreach ($rows as $row) {
            $canonical = class_exists('BSMS_Providers') ? BSMS_Providers::canonical_job_status($row) : strtolower((string)$row['status_bucket']);
            if (isset($summary[$canonical])) $summary[$canonical]++;
            else $summary['pending']++;
            $summary['cost'] += intval($row['cost_kobo'] ?? 0);
        }

        $successful = intval($summary['accepted']) + intval($summary['delivered']);
        $unresolved = max(0, intval($summary['total']) - $successful - intval($summary['failed']));
        $ledger = BSMS_DB::table('ledger');
        $job_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bsms_jobs WHERE campaign_id=%d AND user_id=%d", $campaign_id, $user_id));
        $charged = 0; $refunded = 0;
        foreach ((array)$job_ids as $job_id) {
            $charged += abs(intval($wpdb->get_var($wpdb->prepare("SELECT COALESCE(SUM(amount_kobo),0) FROM {$wpdb->prefix}bsms_ledger WHERE user_id=%d AND type='sms_charge' AND reference=%s", $user_id, 'JOB-'.intval($job_id)))));
            $refunded += intval($wpdb->get_var($wpdb->prepare("SELECT COALESCE(SUM(amount_kobo),0) FROM {$wpdb->prefix}bsms_ledger WHERE user_id=%d AND reference=%s AND amount_kobo>0", $user_id, 'REFUND-JOB-'.intval($job_id))));
        }
        // v3.5.0: plain wording, and the customer's own name for the send.
        $name = trim((string)$wpdb->get_var($wpdb->prepare("SELECT name FROM {$wpdb->prefix}bsms_campaigns WHERE id=%d", $campaign_id)));
        $label = ($name !== '' && $name !== 'Portal Campaign') ? '“'.$name.'”' : sprintf(/* translators: %s: a value filled in when shown */ __('your send #%s', 'bulk-sms-portal'), $campaign_id);
        $outcome = intval($summary['failed']) === intval($summary['total']) ? __('Your messages failed', 'bulk-sms-portal') : (intval($summary['failed']) > 0 ? __('Some messages failed', 'bulk-sms-portal') : __('All messages sent', 'bulk-sms-portal'));
        $msg = "{$outcome} for {$label}.\n\nMessages: ".intval($summary['total']).__("\nSuccessful: ", 'bulk-sms-portal').$successful.__("\nFailed: ", 'bulk-sms-portal').intval($summary['failed']).($unresolved ? sprintf(/* translators: %s: a value filled in when shown */ __('
Still sending: %s', 'bulk-sms-portal'), $unresolved) : '').__("\nCharged: ", 'bulk-sms-portal').BSMS_Util::money($charged).__("\nReturned for failed messages: ", 'bulk-sms-portal').BSMS_Util::money($refunded).".";
        self::notify($user_id, 'campaign', $outcome.': '.wp_strip_all_tags($label), $msg, array('campaign_id'=>$campaign_id,'idempotency_key'=>'campaign_'.$campaign_id,'cta_label'=>__('See delivery report', 'bulk-sms-portal'),'cta_url'=>BSMS_Util::portal_url(array(), 'reports')));
    }

    public static function log($user_id, $type, $channel, $subject, $message, $status='queued', $cost_kobo=0, $reference='', $meta=array()){
        global $wpdb;
        $t = BSMS_DB::table('notifications');
        $wpdb->insert($t, array(
            'user_id'=>intval($user_id),
            'type'=>sanitize_text_field($type),
            'channel'=>sanitize_text_field($channel),
            'subject'=>sanitize_text_field($subject),
            'message'=>sanitize_textarea_field($message),
            'status'=>sanitize_text_field($status),
            'cost_kobo'=>intval($cost_kobo),
            'reference'=>sanitize_text_field($reference),
            'meta_json'=>wp_json_encode($meta),
            'created_at'=>BSMS_Util::now_gmt(),
            'sent_at'=>$status === 'sent' ? BSMS_Util::now_gmt() : null
        ));
    }
}
