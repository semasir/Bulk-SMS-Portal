<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Portal frame and shared icons for the v3.5.0 design system.
 *
 * The frame (side menu, top bar, phone menu bar) is rendered here once and
 * used by every portal page. Page content is drawn by assets/portal-app.js
 * (redesigned pages) or assets/portal.js (pages not redesigned yet).
 */
class BSMS_UI {

    /** Menu sections, in order. Pages not listed fall into "More". */
    public static function nav_groups(){
        return array(
            'home'     => array('label'=>'',          'pages'=>array('dashboard')),
            'messages' => array('label'=>__('Messages', 'bulk-sms-portal'),  'pages'=>array('compose','history','reports','groups','sender')),
            'money'    => array('label'=>__('Money', 'bulk-sms-portal'),     'pages'=>array('fund','transactions','pricing')),
            'account'  => array('label'=>__('Account', 'bulk-sms-portal'),   'pages'=>array('settings','profile','api','help')),
        );
    }


    public static function icon_for_page($page){
        $map = array(
            'dashboard'=>'home','compose'=>'send','history'=>'list','reports'=>'chart','groups'=>'people','sender'=>'badge',
            'fund'=>'wallet','transactions'=>'receipt','pricing'=>'tag','settings'=>'bell','profile'=>'user','api'=>'plug','help'=>'help',
            'admin-dashboard'=>'shield','admin-users'=>'people','admin-credit'=>'receipt','admin-apis'=>'plug','admin-pricing'=>'tag',
            'admin-senders'=>'badge','admin-broadcast'=>'bell','admin-analytics'=>'chart','admin-help'=>'help','admin-settings'=>'gear','admin-monitoring'=>'pulse',
        );
        return $map[$page] ?? 'page';
    }

    /** Inline SVG icon. Stroke icons on a 24px grid. */

    /**
     * Tags and attributes allowed when printing portal markup built by this plugin
     * (icons, menus, form fields). Used with wp_kses() so every printed value is escaped.
     */
    public static function allowed_html(){
        static $rules = null;
        if ($rules !== null) return $rules;
        $rules = wp_kses_allowed_html('post');
        $common = array('id'=>true,'class'=>true,'style'=>true,'title'=>true,'role'=>true,'hidden'=>true,'tabindex'=>true,'lang'=>true,'dir'=>true,
            'aria-label'=>true,'aria-labelledby'=>true,'aria-describedby'=>true,'aria-hidden'=>true,'aria-live'=>true,'aria-controls'=>true,
            'aria-expanded'=>true,'aria-current'=>true,'aria-pressed'=>true,'aria-selected'=>true,'aria-modal'=>true,'aria-busy'=>true,
            'aria-invalid'=>true,'aria-required'=>true,'aria-haspopup'=>true,'aria-atomic'=>true,'aria-valuenow'=>true,'aria-valuemin'=>true,'aria-valuemax'=>true,'data-*'=>true);
        $svg = array('width'=>true,'height'=>true,'viewbox'=>true,'fill'=>true,'stroke'=>true,'stroke-width'=>true,'stroke-linecap'=>true,'stroke-linejoin'=>true,
            'focusable'=>true,'xmlns'=>true,'d'=>true,'cx'=>true,'cy'=>true,'r'=>true,'rx'=>true,'ry'=>true,'x'=>true,'y'=>true,'x1'=>true,'y1'=>true,'x2'=>true,'y2'=>true,
            'points'=>true,'transform'=>true,'opacity'=>true,'fill-rule'=>true,'clip-rule'=>true);
        $extra = array(
            'svg'=>$svg,'path'=>$svg,'circle'=>$svg,'rect'=>$svg,'line'=>$svg,'polyline'=>$svg,'polygon'=>$svg,'g'=>$svg,'ellipse'=>$svg,
            'form'=>array('method'=>true,'action'=>true,'novalidate'=>true,'enctype'=>true,'autocomplete'=>true,'name'=>true),
            'input'=>array('type'=>true,'name'=>true,'value'=>true,'placeholder'=>true,'autocomplete'=>true,'required'=>true,'checked'=>true,'disabled'=>true,
                'readonly'=>true,'min'=>true,'max'=>true,'step'=>true,'maxlength'=>true,'minlength'=>true,'pattern'=>true,'inputmode'=>true,'accept'=>true,
                'multiple'=>true,'size'=>true,'list'=>true,'autofocus'=>true,'spellcheck'=>true,'autocapitalize'=>true),
            'select'=>array('name'=>true,'required'=>true,'multiple'=>true,'disabled'=>true,'size'=>true,'autocomplete'=>true),
            'option'=>array('value'=>true,'selected'=>true,'disabled'=>true,'label'=>true),
            'optgroup'=>array('label'=>true,'disabled'=>true),
            'textarea'=>array('name'=>true,'rows'=>true,'cols'=>true,'placeholder'=>true,'required'=>true,'maxlength'=>true,'readonly'=>true,'disabled'=>true,'spellcheck'=>true,'autocomplete'=>true),
            'button'=>array('type'=>true,'name'=>true,'value'=>true,'disabled'=>true,'form'=>true),
            'label'=>array('for'=>true),'fieldset'=>array('disabled'=>true,'name'=>true),'legend'=>array(),'output'=>array('for'=>true,'name'=>true),
            'progress'=>array('value'=>true,'max'=>true),'meter'=>array('value'=>true,'min'=>true,'max'=>true,'low'=>true,'high'=>true,'optimum'=>true),
            'dialog'=>array('open'=>true),'template'=>array(),'datalist'=>array(),'main'=>array(),'nav'=>array(),'aside'=>array(),'header'=>array(),'footer'=>array(),
            'section'=>array(),'article'=>array(),'details'=>array('open'=>true),'summary'=>array(),'small'=>array(),'time'=>array('datetime'=>true),'kbd'=>array(),'output'=>array(),
        );
        foreach ($extra as $tag => $attrs) {
            $rules[$tag] = array_merge(isset($rules[$tag]) ? $rules[$tag] : array(), $attrs);
        }
        foreach ($rules as $tag => $attrs) {
            $rules[$tag] = array_merge(is_array($attrs) ? $attrs : array(), $common);
        }
        return $rules;
    }

    /** Print plugin-built markup through wp_kses(). */
    public static function kses($html){
        return wp_kses((string) $html, self::allowed_html());
    }

    public static function icon($name, $size = 20){
        $p = array(
            'home'   => '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5.5h4V20"/>',
            'send'   => '<path d="M20.5 3.5 10 14"/><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
            'list'   => '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/>',
            'chart'  => '<path d="M3.5 20.5h17"/><path d="M6.5 17v-6M11.5 17V6.5M16.5 17v-9"/>',
            'people' => '<circle cx="9" cy="8" r="3.5"/><path d="M2.8 20c.8-3.6 3.3-5.6 6.2-5.6s5.4 2 6.2 5.6"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M17.6 14.7c1.9.8 3.1 2.6 3.6 5.3"/>',
            'badge'  => '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 10h6M7 14h10"/>',
            'wallet' => '<path d="M4 7.5V6a2 2 0 0 1 2-2h11v3.5"/><rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M16 13.5h1.5"/>',
            'receipt'=> '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9 8.5h6M9 12.5h6"/>',
            'tag'    => '<path d="M3.5 12V4.5H11l9.5 9.5-7.5 7.5z"/><circle cx="7.7" cy="8.7" r="1.4"/>',
            'bell'   => '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 1.8H4.2z"/><path d="M10 20.5a2.1 2.1 0 0 0 4 0"/>',
            'user'   => '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c1-4.4 4.1-6.8 8-6.8s7 2.4 8 6.8"/>',
            'plug'   => '<path d="M9 3v4.5M15 3v4.5"/><path d="M6 7.5h12v3.5a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
            'help'   => '<circle cx="12" cy="12" r="8.8"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.8c0 1.7-2.5 2.1-2.5 3.6"/><path d="M12 17.2h.01" stroke-width="2.4"/>',
            'shield' => '<path d="M12 3.2 19.5 6v5.7c0 4.4-3.1 7.8-7.5 9.1-4.4-1.3-7.5-4.7-7.5-9.1V6z"/><path d="m9 12 2.1 2.1L15.2 10"/>',
            'gear'   => '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>',
            'pulse'  => '<path d="M3 12h4l2.2-6 4.3 12 2.2-6H21"/>',
            'page'   => '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
            'logout' => '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
            'menu'   => '<path d="M4 7h16M4 12h16M4 17h16"/>',
            'more'   => '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3"/>',
            'chev'   => '<path d="m9 6 6 6-6 6"/>',
        );
        $body = $p[$name] ?? $p['page'];
        return '<svg width="'.intval($size).'" height="'.intval($size).'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'.$body.'</svg>';
    }

    private static function initials($name){
        $parts = preg_split('/\s+/', trim((string)$name));
        $out = '';
        foreach ($parts as $part) { if ($part !== '') $out .= function_exists('mb_substr') ? mb_substr($part, 0, 1) : substr($part, 0, 1); if (strlen($out) >= 2) break; }
        return strtoupper($out ?: 'A');
    }

    /** One menu button. data-page keeps older page links and focus handling working. */
    private static function nav_item($page, $label){
        return sprintf(
            '<button type="button" class="bx-nav-item" data-page="%1$s" data-route="%2$s">%3$s<span>%4$s</span></button>',
            esc_attr($page), esc_attr(BSMS_Portal::route_for_page($page)), self::icon(self::icon_for_page($page)), esc_html($label)
        );
    }

    /** Builds the grouped menu from the portal's page registry. */
    public static function nav_html($member, $admin){
        $html = '';
        $used = array();
        foreach (self::nav_groups() as $key=>$group) {
            $items = '';
            foreach ($group['pages'] as $page) {
                if (!isset($member[$page])) continue;
                $items .= self::nav_item($page, $member[$page]);
                $used[$page] = true;
            }
            if ($items === '') continue;
            $label = $group['label'] ? '<p class="bx-nav-label">'.esc_html($group['label']).'</p>' : '';
            $html .= '<div class="bx-nav-group">'.$label.$items.'</div>';
        }
        $more = '';
        foreach ($member as $page=>$label) {
            if (isset($used[$page])) continue;
            $more .= self::nav_item($page, is_array($label) ? ($label['label'] ?? $page) : $label);
        }
        if ($more !== '') $html .= ('<div class="bx-nav-group"><p class="bx-nav-label">' . esc_html__('More', 'bulk-sms-portal') . '</p>').$more.'</div>';
        if (!empty($admin)) {
            $items = '';
            foreach ($admin as $page=>$label) $items .= self::nav_item($page, $label);
            $html .= ('<div class="bx-nav-group"><p class="bx-nav-label">' . esc_html__('Platform admin', 'bulk-sms-portal') . '</p>').$items.'</div>';
        }
        return $html;
    }

    public static function brand_html($class){
        $logo = BSMS_Util::logo_url();
        $display = get_option('bsms_sidebar_brand_display', 'logo_only');
        $name = BSMS_Util::brand_name();
        $inner = '';
        if ($logo && in_array($display, array('logo_only','logo_name'), true)) $inner .= '<img src="'.esc_url($logo).'" alt="'.esc_attr($name).'">';
        if (!$logo || in_array($display, array('name_only','logo_name'), true)) $inner .= '<span>'.esc_html($name).'</span>';
        return '<a class="'.esc_attr($class).'" href="'.esc_url(BSMS_Util::portal_url(array(), 'dashboard')).'" data-bx-home aria-label="'.esc_attr($name).' home">'.$inner.'</a>';
    }

    /** The whole portal frame. $sections is the HTML of the page <section>s. */
    public static function frame($menus, $sections){
        $user = wp_get_current_user();
        $name = $user && $user->exists() ? ($user->display_name ?: $user->user_login) : '';
        $email = $user && $user->exists() ? $user->user_email : '';
        $balance = $user && $user->exists() && class_exists('BSMS_Wallet') ? BSMS_Wallet::get_balance_kobo($user->ID) : 0;
        $money = BSMS_Util::money($balance);
        $member = $menus['member'];
        $admin = $menus['admin'];
        $can_buy = isset($member['fund']);
        $can_send = isset($member['compose']);
        $logout = wp_logout_url(BSMS_Portal::auth_page_url('login'));

        ob_start(); ?>
<a class="bx bx-skip" href="#bsms-main-content"><?php esc_html_e('Skip to main content', 'bulk-sms-portal'); ?></a>
<div id="bsms-connection-status" class="bsms-connection-status" role="status" aria-live="polite" hidden></div>
<div id="bsms-app" class="bx-app<?php echo BSMS_Portal::can_manage() ? ' bsms-is-admin' : ''; ?>" data-build="<?php echo esc_attr(BSMS_PRO_VERSION); ?>" data-owner="<?php echo BSMS_Portal::can_manage() ? '1' : '0'; ?>" style="<?php echo esc_attr(BSMS_Util::design_style_attr()); ?>">
  <aside class="bx bx-rail" id="bx-rail" aria-label="<?php esc_attr_e('Portal menu', 'bulk-sms-portal'); ?>">
    <?php echo wp_kses(self::brand_html('bx-brand'), self::allowed_html()); ?>
    <div class="bx-wallet" aria-live="polite">
      <span class="bx-wallet-label"><?php esc_html_e('Wallet balance', 'bulk-sms-portal'); ?></span>
      <span class="bx-wallet-amount" data-bx-balance><?php echo esc_html($money); ?></span>
      <span class="bx-wallet-note" data-bx-balance-note><?php esc_html_e('Money you can spend on SMS', 'bulk-sms-portal'); ?></span>
      <?php if ($can_buy) : ?><button type="button" class="bx-btn" data-page="fund"><?php esc_html_e('Buy SMS', 'bulk-sms-portal'); ?></button><?php endif; ?>
    </div>
    <nav class="bx-nav" aria-label="<?php esc_attr_e('Portal pages', 'bulk-sms-portal'); ?>"><?php echo wp_kses(self::nav_html($member, $admin), self::allowed_html()); ?></nav>
    <div class="bx-rail-foot">
      <div class="bx-me">
        <span class="bx-me-avatar" aria-hidden="true"><?php echo esc_html(self::initials($name)); ?></span>
        <span class="bx-me-text"><strong><?php echo esc_html($name); ?></strong><small><?php echo esc_html($email); ?></small></span>
      </div>
      <a class="bx-nav-item" href="<?php echo esc_url($logout); ?>"><?php echo wp_kses(self::icon('logout'), self::allowed_html()); ?><span><?php esc_html_e('Log out', 'bulk-sms-portal'); ?></span></a>
    </div>
  </aside>
  <div class="bx bx-scrim" data-bx-close-nav></div>
  <main class="bx-main" id="bsms-main-content" tabindex="-1">
    <header class="bx bx-top">
      <button type="button" class="bx-menu-btn" data-bx-open-nav aria-controls="bx-rail" aria-expanded="false"><?php echo wp_kses(self::icon('menu', 22), self::allowed_html()); ?><span class="bx-sr"><?php esc_html_e('Open menu', 'bulk-sms-portal'); ?></span></button>
      <?php echo wp_kses(self::brand_html('bx-top-brand'), self::allowed_html()); ?>
      <div class="bx-crumb"><span data-bx-crumb-section><?php esc_html_e('Home', 'bulk-sms-portal'); ?></span><?php echo wp_kses(self::icon('chev', 16), self::allowed_html()); ?><strong data-bx-crumb-page><?php esc_html_e('Dashboard', 'bulk-sms-portal'); ?></strong></div>
      <div class="bx-top-actions">
        <?php if ($can_buy) : ?><button type="button" class="bx-top-balance" data-page="fund" aria-label="<?php esc_attr_e('Wallet balance, buy SMS', 'bulk-sms-portal'); ?>"><span data-bx-balance><?php echo esc_html($money); ?></span></button><?php endif; ?>
        <?php if (BSMS_Portal::can_manage()) : ?><button type="button" class="bx-btn is-quiet" data-page="admin-dashboard"><?php esc_html_e('Admin dashboard', 'bulk-sms-portal'); ?></button><?php endif; ?>
        <?php if ($can_send) : ?><button type="button" class="bx-btn is-primary" data-page="compose"><?php echo wp_kses(self::icon('send', 18), self::allowed_html()); ?><?php esc_html_e('Send SMS', 'bulk-sms-portal'); ?></button><?php endif; ?>
      </div>
    </header>
    <div class="bx bx-notices" id="bx-notices" aria-live="polite"></div>
    <?php echo wp_kses($sections, self::allowed_html()); ?>
  </main>
  <nav class="bx bx-dock" aria-label="<?php esc_attr_e('Quick menu', 'bulk-sms-portal'); ?>">
    <button type="button" data-page="dashboard"><?php echo wp_kses(self::icon('home', 22), self::allowed_html()); ?><span><?php esc_html_e('Home', 'bulk-sms-portal'); ?></span></button>
    <?php if ($can_send) : ?><button type="button" data-page="compose" class="is-send"><?php echo wp_kses(self::icon('send', 22), self::allowed_html()); ?><span><?php esc_html_e('Send', 'bulk-sms-portal'); ?></span></button><?php endif; ?>
    <?php if (isset($member['history'])) : ?><button type="button" data-page="history"><?php echo wp_kses(self::icon('list', 22), self::allowed_html()); ?><span><?php esc_html_e('History', 'bulk-sms-portal'); ?></span></button><?php endif; ?>
    <?php if ($can_buy) : ?><button type="button" data-page="fund"><?php echo wp_kses(self::icon('wallet', 22), self::allowed_html()); ?><span><?php esc_html_e('Buy SMS', 'bulk-sms-portal'); ?></span></button><?php endif; ?>
    <button type="button" data-bx-open-nav aria-controls="bx-rail" aria-expanded="false"><?php echo wp_kses(self::icon('more', 22), self::allowed_html()); ?><span><?php esc_html_e('More', 'bulk-sms-portal'); ?></span></button>
  </nav>
</div>
        <?php
        return ob_get_clean();
    }

    /* ------------------------------------------------------------------
     * v3.6.0 — WordPress admin twins.
     * Each plugin screen in WordPress admin runs the very same page as the
     * portal's admin page (same script function, same REST data), shown
     * without the portal frame.
     * ------------------------------------------------------------------ */

    /** v3.6.0: one name for each admin page, used by the portal menu, the
     *  WordPress admin menu and the page titles. */
    public static function admin_labels(){
        return array(
            'admin-dashboard'=>__('Admin Dashboard', 'bulk-sms-portal'),'admin-users'=>__('Users & Wallets', 'bulk-sms-portal'),'admin-credit'=>__('Payments', 'bulk-sms-portal'),
            'admin-apis'=>__('SMS Services', 'bulk-sms-portal'),'admin-pricing'=>__('Pricing Manager', 'bulk-sms-portal'),'admin-senders'=>__('Sender ID Manager', 'bulk-sms-portal'),
            'admin-broadcast'=>__('Customer Notices', 'bulk-sms-portal'),'admin-analytics'=>__('Reports & Insights', 'bulk-sms-portal'),'admin-help'=>__('Help Content', 'bulk-sms-portal'),
            'admin-settings'=>__('Platform Settings', 'bulk-sms-portal'),'admin-monitoring'=>__('System Checks', 'bulk-sms-portal'),
        );
    }

    /** v3.6.1: admin tools reached from Platform Settings and the Admin
     *  Dashboard rather than the menu. Page => [name, WordPress admin slug]. */
    public static function admin_extra_pages(){
        $pages = array(
            'admin-setup'    => array(__('Setup Guide', 'bulk-sms-portal'), 'bulk-sms-portal-setup'),
            'admin-activity' => array(__('Activity Log', 'bulk-sms-portal'), 'bulk-sms-portal-activity-logs'),
        );
        // Add-ons add their own admin pages here.
        $more = apply_filters('bsms_admin_extra_pages', array());
        return is_array($more) ? $pages + $more : $pages;
    }

    /** v3.6.1: older WordPress admin screens that duplicated a redesigned
     *  page now open that page (slug => [page, tab]). */
    public static function admin_redirects(){
        $map = array(
            'bulk-sms-portal-credit'              => array('admin-users', ''),
            'bulk-sms-portal-settings'            => array('admin-settings', 'branding'),
            'bulk-sms-portal-design-tokens'       => array('admin-settings', 'branding'),
            'bulk-sms-portal-dashboard-styling'   => array('admin-settings', 'branding'),
            'bulk-sms-portal-payment-gateways'    => array('admin-settings', 'payments'),
            'bulk-sms-portal-funding-accounts'    => array('admin-settings', 'funding'),
            'bulk-sms-portal-auth-security'       => array('admin-settings', 'security'),
            'bulk-sms-portal-white-label-controls'=> array('admin-settings', 'features'),
            'bulk-sms-portal-routes'              => array('admin-apis', ''),
            'bulk-sms-portal-provider-health'     => array('admin-apis', ''),
            'bulk-sms-portal-api-docs'            => array('admin-apis', ''),
            'bulk-sms-portal-final-health'        => array('admin-monitoring', ''),
            'bulk-sms-portal-menu-audit'          => array('admin-monitoring', ''),
            'bulk-sms-portal-notification-logs'   => array('admin-activity', 'notifications'),
        );
        // Addresses used before the plugin was renamed (wp-bulk-sms-portal*) keep working.
        $old = array();
        foreach ($map as $slug => $to) $old['wp-' . $slug] = $to;
        foreach (self::admin_twins() as $page => $slug) $old['wp-' . $slug] = array($page, '');
        return $map + $old;
    }

    /** WordPress admin address for any admin page (main or extra). */
    public static function admin_page_url($page, $tab = ''){
        $slug = self::admin_twins()[$page] ?? (self::admin_extra_pages()[$page][1] ?? '');
        if (!$slug) return admin_url('admin.php?page=bulk-sms-portal');
        return admin_url('admin.php?page=' . $slug) . ($tab ? '#tab=' . rawurlencode($tab) : '');
    }

    /** Portal admin page => WordPress admin screen slug. */
    public static function admin_twins(){
        return array(
            'admin-dashboard'  => 'bulk-sms-portal',
            'admin-users'      => 'bulk-sms-portal-users-wallets',
            'admin-credit'     => 'bulk-sms-portal-funding',
            'admin-apis'       => 'bulk-sms-portal-api',
            'admin-pricing'    => 'bulk-sms-portal-pricing',
            'admin-senders'    => 'bulk-sms-portal-senders',
            'admin-broadcast'  => 'bulk-sms-portal-notices',
            'admin-analytics'  => 'bulk-sms-portal-analytics',
            'admin-help'       => 'bulk-sms-portal-help-content',
            'admin-settings'   => 'bulk-sms-portal-system-settings',
            'admin-monitoring' => 'bulk-sms-portal-diagnostics',
        );
    }

    /** Where each page lives when it is not on the current screen. */
    private static function embedded_page_urls(){
        $urls = array();
        foreach (self::admin_twins() as $page=>$slug) $urls[$page] = admin_url('admin.php?page=' . $slug);
        foreach (self::admin_extra_pages() as $page=>$def) $urls[$page] = admin_url('admin.php?page=' . $def[1]);
        foreach (array('dashboard','compose','history','reports','transactions','fund','pricing','sender','groups','settings','profile','api','help') as $p) {
            $urls[$p] = home_url('/' . BSMS_Portal::portal_slug() . '/' . BSMS_Portal::route_for_page($p));
        }
        return $urls;
    }

    /** Renders one redesigned page inside WordPress admin. */
    public static function admin_screen($page){
        if (!current_user_can('manage_options') && !BSMS_Portal::can_manage()) { wp_die(esc_html__('You are not allowed to open this page.', 'bulk-sms-portal')); }
        if (!wp_script_is('bsms-portal-app', 'registered')) BSMS_Portal::assets();
        $config = array(
            'root'=>esc_url_raw(rest_url('bsms/v1')),
            'nonce'=>wp_create_nonce('wp_rest'),
            'ajaxUrl'=>admin_url('admin-ajax.php'),
            'brand'=>BSMS_Util::brand_name(),
            'isAdmin'=>true,
            'userId'=>get_current_user_id(),
            'supportEmail'=>BSMS_Util::support_email(),
            'entitlements'=>class_exists('BSMS_Entitlements') ? BSMS_Entitlements::matrix(get_current_user_id()) : array(),
            'customMenus'=>array(),
            'cleanRoutes'=>false,
            'portalBase'=>'',
            'routeMap'=>BSMS_Portal::route_map(),
            'initialPage'=>$page,
            'announcements'=>array(),
            'embedded'=>true,
            'pageUrls'=>self::embedded_page_urls(),
            'portalUrl'=>BSMS_Portal::portal_url(),
        );
        wp_enqueue_media();
        wp_enqueue_style('bsms-portal-ui');
        wp_add_inline_script('bsms-portal', 'window.BSMS_PORTAL = '.wp_json_encode($config).';', 'before');
        wp_enqueue_script('bsms-portal');
        wp_enqueue_script('bsms-portal-app');
        do_action('bsms_portal_scripts'); // add-ons enqueue their portal screens here
        echo '<div id="bsms-app" class="bx-app bx-embedded bsms-is-admin" data-owner="1" style="'.esc_attr(BSMS_Util::design_style_attr()).'">';
        echo '<div class="bx bx-notices" id="bx-notices" aria-live="polite"></div>';
        echo '<section id="bsms-page-'.esc_attr($page).'" class="bsms-page"></section>';
        echo '</div>';
    }
}
