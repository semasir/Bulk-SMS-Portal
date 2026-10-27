<?php
if (!defined('ABSPATH')) { exit; }
/**
 * Public presentation contracts supplied by the plugin.
 * Elementor/the active theme owns page layout; these shortcodes expose
 * canonical product content without duplicating it in page-builder copy.
 */
class BSMS_Shortcodes {
    public static function init(){
        add_shortcode('bsms_help_centre', array(__CLASS__, 'help_centre'));
        // The canonical public Help Centre should reflect the same published
        // product-help dataset without requiring a second manually-maintained copy.
        add_filter('the_content', array(__CLASS__, 'attach_to_public_help_centre'), 25);
    }
    /** Small public behaviours (help search, copy buttons) and the API section styles. */
    public static function enqueue_widgets($api_styles = false){
        $js = BSMS_PRO_PATH . 'assets/public-widgets.js';
        wp_enqueue_script('bsms-public-widgets', BSMS_PRO_URL . 'assets/public-widgets.js', array('wp-i18n'), file_exists($js) ? (string) filemtime($js) : BSMS_PRO_VERSION, true);
        wp_set_script_translations('bsms-public-widgets', 'bulk-sms-portal');
        if ($api_styles) {
            $css = BSMS_PRO_PATH . 'assets/public-api.css';
            wp_enqueue_style('bsms-public-api', BSMS_PRO_URL . 'assets/public-api.css', array(), file_exists($css) ? (string) filemtime($css) : BSMS_PRO_VERSION);
        }
    }

    private static function enqueue_public_assets(){
        // Public Help Centre gets a deliberately isolated stylesheet. Loading the
        // full portal stylesheet on an Elementor/public page risks coupling the
        // website shell to portal-only layout rules.
        $handle = 'bsms-public-help';
        if (!wp_style_is($handle, 'registered')) {
            $css_file = BSMS_PRO_PATH . 'assets/public-help.css';
            $ver = file_exists($css_file) ? (string) filemtime($css_file) : BSMS_PRO_VERSION;
            wp_register_style($handle, BSMS_PRO_URL . 'assets/public-help.css', array(), $ver);
        }
        wp_enqueue_style($handle);
    }
    private static function page_already_contains_help_component($post_id){
        $post=get_post($post_id);
        if(!$post) return false;
        $names=(array)apply_filters('bsms_help_component_shortcodes', array('bsms_help_centre'));
        $elementor=(string)get_post_meta($post_id, '_elementor_data', true);
        foreach($names as $name){
            if(has_shortcode((string)$post->post_content, $name)) return true;
            if($elementor!=='' && strpos($elementor, $name)!==false) return true;
        }
        return false;
    }
    public static function attach_to_public_help_centre($content){
        if(is_admin() || !is_singular('page') || !in_the_loop() || !is_main_query()) return $content;
        $post=get_post();
        if(!$post) return $content;
        $configured = class_exists('BSMS_Portal') ? BSMS_Portal::auth_page_url('help') : '';
        $configured_path = $configured ? untrailingslashit((string)wp_parse_url($configured, PHP_URL_PATH)) : '';
        $current_path = untrailingslashit((string)wp_parse_url(get_permalink($post), PHP_URL_PATH));
        $is_help_page = ($configured_path !== '' && $current_path === $configured_path)
            || in_array($post->post_name, array('help','help-centre'), true);
        if(!$is_help_page) return $content;
        if(self::page_already_contains_help_component($post->ID)) return $content;
        // Keep Elementor/the theme in charge of the page presentation while the
        // plugin supplies the live product-help catalogue below that presentation.
        return $content . '<div class="bsms-public-help-mount">' . self::help_centre() . '</div>';
    }
    private static function public_help(){
        $saved=class_exists('BSMS_REST') ? BSMS_REST::help_content_all() : get_option('bsms_help_content_v1', array());
        $out=array('troubleshooting'=>array(),'knowledge'=>array(),'channels'=>array(),'suggestions'=>array());
        foreach($out as $type=>$blank){
            foreach((array)($saved[$type]??array()) as $item){
                if(empty($item['enabled']) || (($item['status']??'published')!=='published')) continue;
                if(($item['visibility']??'everyone')!=='everyone') continue;
                $out[$type][]=$item;
            }
            usort($out[$type],function($a,$b){return intval($a['order']??0)<=>intval($b['order']??0);});
        }
        return $out;
    }
    public static function help_centre($atts=array()){
        self::enqueue_public_assets();
        self::enqueue_widgets();
        $data=self::public_help();
        ob_start(); ?>
        <section class="bsms-public-help" data-bsms-public-help aria-label="<?php echo esc_attr(BSMS_Util::brand_name()); ?> Help Centre">
          <div class="bsms-public-help-search"><label for="bsmsPublicHelpSearch"><?php esc_html_e('Search Help Centre', 'bulk-sms-portal'); ?></label><div><input id="bsmsPublicHelpSearch" type="search" placeholder="<?php esc_attr_e('Search sending, payments, Sender ID, account…', 'bulk-sms-portal'); ?>"><button type="button"><?php esc_html_e('Search', 'bulk-sms-portal'); ?></button></div>
          <?php if(!empty($data['suggestions'])): ?><div class="bsms-public-help-suggestions" aria-label="<?php esc_attr_e('Popular help searches', 'bulk-sms-portal'); ?>"><?php foreach($data['suggestions'] as $x): ?><button type="button" data-help-query="<?php echo esc_attr($x['query']??$x['title']??''); ?>"><?php echo esc_html($x['title']??__('Help', 'bulk-sms-portal')); ?></button><?php endforeach; ?></div><?php endif; ?></div>
          <?php if(!empty($data['troubleshooting'])): ?><div class="bsms-public-help-section"><h2><?php esc_html_e('Common questions', 'bulk-sms-portal'); ?></h2><div class="bsms-public-help-faq"><?php foreach($data['troubleshooting'] as $x): ?><details data-help-text="<?php echo esc_attr(($x['title']??'').' '.($x['category']??'').' '.($x['keywords']??'').' '.wp_strip_all_tags($x['body']??'')); ?>"><summary><?php echo esc_html($x['title']??__('Help', 'bulk-sms-portal')); ?></summary><div><?php echo wp_kses_post(wpautop($x['body']??'')); ?></div></details><?php endforeach; ?></div></div><?php endif; ?>
          <?php if(!empty($data['knowledge'])): ?><div class="bsms-public-help-section"><h2><?php esc_html_e('Help articles', 'bulk-sms-portal'); ?></h2><div class="bsms-public-help-grid"><?php foreach($data['knowledge'] as $x): ?><article data-help-text="<?php echo esc_attr(($x['title']??'').' '.($x['summary']??'').' '.($x['category']??'').' '.($x['keywords']??'').' '.wp_strip_all_tags($x['body']??'')); ?>"><span><?php echo esc_html($x['category']??__('Help', 'bulk-sms-portal')); ?></span><h3><?php echo esc_html($x['title']??__('Help article', 'bulk-sms-portal')); ?></h3><?php if(!empty($x['summary'])):?><p><?php echo esc_html($x['summary']); ?></p><?php endif; ?><?php if(!empty($x['body'])):?><div class="bsms-public-help-body"><?php echo wp_kses_post(wpautop($x['body'])); ?></div><?php endif; ?></article><?php endforeach; ?></div></div><?php endif; ?>
          <?php if(!empty($data['channels'])): ?><div class="bsms-public-help-section"><h2><?php esc_html_e('Contact support', 'bulk-sms-portal'); ?></h2><div class="bsms-public-help-grid bsms-public-help-support"><?php foreach($data['channels'] as $x): ?><article data-help-text="<?php echo esc_attr(($x['title']??'').' '.($x['summary']??'').' '.wp_strip_all_tags($x['body']??'')); ?>"><h3><?php echo esc_html($x['title']??__('Support', 'bulk-sms-portal')); ?></h3><?php if(!empty($x['summary'])):?><p><?php echo esc_html($x['summary']); ?></p><?php endif; ?><?php if(!empty($x['body'])):?><div class="bsms-public-help-body"><?php echo wp_kses_post(wpautop($x['body'])); ?></div><?php endif; ?><?php if(!empty($x['availability'])):?><small><?php echo esc_html($x['availability']); ?></small><?php endif; ?></article><?php endforeach; ?></div></div><?php endif; ?>
          <p class="bsms-public-help-empty" hidden><?php esc_html_e('No matching help content was found. Try a broader search.', 'bulk-sms-portal'); ?></p>
        </section>
        <?php return ob_get_clean();
    }
}
