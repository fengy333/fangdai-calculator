/**
 * ============================================================
 *  site.js —— 站点通用脚本
 * ------------------------------------------------------------
 *  职责：
 *   1. Cookie 同意状态管理（默认拒绝，用户选择后回传）
 *   2. 按需加载第三方脚本（用户未同意前不加载）
 *   3. 广告位懒渲染（进入视口才请求，避免拖慢首屏）
 *   4. 注入 canonical / og / twitter 等 SEO 标签
 *   5. 文章页自动注入 Article 结构化数据
 *
 *  这个文件需要在本页 <head> 里、其他第三方脚本之前引入。
 *  所有可调参数都在 js/site-config.js 里。
 * ============================================================
 */
(function () {
    'use strict';

    var CFG = window.SITE_CONFIG || {};
    var ADS = CFG.adsense || {};
    var GA = CFG.analytics || {};
    var CONSENT = CFG.consent || {};
    var CONSENT_KEY = 'site-consent-choice-v1';

    /* =========================================================
     * 0. 全局队列
     * ======================================================= */
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.adsbygoogle = window.adsbygoogle || [];

    var gtag = window.gtag;

    /* =========================================================
     * 1. 小工具
     * ======================================================= */
    function merge(target, source) {
        for (var k in source) {
            if (Object.prototype.hasOwnProperty.call(source, k)) target[k] = source[k];
        }
        return target;
    }

    function origin() {
        var u = String(CFG.siteUrl || '').replace(/\/+$/, '');
        return u || (location.protocol + '//' + location.host);
    }

    function absUrl(path) {
        if (!path) return origin() + '/';
        if (/^https?:\/\//i.test(path)) return path;
        return origin() + (path.charAt(0) === '/' ? path : '/' + path);
    }

    function pageUrl() {
        return origin() + location.pathname.replace(/\/index\.html$/, '/');
    }

    function store(key, value) {
        try {
            if (value === undefined) return window.localStorage.getItem(key);
            window.localStorage.setItem(key, value);
        } catch (e) { /* 无痕模式或用户禁用了本地存储 */ }
        return null;
    }

    function closest(el, selector) {
        while (el && el.nodeType === 1) {
            if (el.matches ? el.matches(selector) : false) return el;
            el = el.parentNode;
        }
        return null;
    }

    function metaContent(name) {
        var el = document.querySelector('meta[name="' + name + '"]');
        return el ? (el.getAttribute('content') || '') : '';
    }

    /* =========================================================
     * 2. 同意状态初始化
     *    —— 必须在任何第三方脚本加载之前执行
     * ======================================================= */
    var consentChoice = null;   // 'granted' | 'denied' | null（尚未选择）

    function consentPayload(state) {
        return {
            ad_storage: state,
            ad_user_data: state,
            ad_personalization: state,
            analytics_storage: state
        };
    }

    function consentGranted() {
        return CONSENT.enabled === false ? true : consentChoice === 'granted';
    }

    function initConsentMode() {
        if (CONSENT.enabled === false) {
            gtag('consent', 'default', consentPayload('granted'));
            consentChoice = 'granted';
            return;
        }
        gtag('consent', 'default',
            merge(consentPayload('denied'), { wait_for_update: 500 }));

        var saved = store(CONSENT_KEY);
        if (saved === 'granted' || saved === 'denied') {
            consentChoice = saved;
            gtag('consent', 'update', consentPayload(saved));
        }
    }

    initConsentMode();

    /* =========================================================
     * 3. 按需加载第三方脚本
     * ======================================================= */
    var gaLoaded = false;
    var adsLoaded = false;

    function loadGA() {
        if (gaLoaded || !GA.enabled || !GA.ga4Id) return;
        gaLoaded = true;
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA.ga4Id);
        document.head.appendChild(s);
        gtag('js', new Date());
        gtag('config', GA.ga4Id, { anonymize_ip: true });
    }

    function loadAdSense() {
        if (adsLoaded || !ADS.enabled || !ADS.publisherId) return;
        adsLoaded = true;

        // 自动广告：控制锚定广告位的显示
        if (ADS.autoAds) {
            window.adsbygoogle.push({
                google_ad_client: ADS.publisherId,
                enable_page_level_ads: true,
                overlays: { bottom: ADS.autoAdsOverlays === true }
            });
        }

        var s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
            encodeURIComponent(ADS.publisherId);
        document.head.appendChild(s);
    }

    function startThirdParty() {
        loadGA();
        loadAdSense();
        renderSlots();
    }

    /* =========================================================
     * 4. 广告位渲染
     *    页面里用 <div class="ad-box" data-ad-slot="top-banner"></div>
     *    标记位置，这里负责填内容。没有配置 ID 的广告位会保持
     *    隐藏，页面上不会出现空洞。
     * ======================================================= */
    var adObserver = null;

    function adsReady() {
        return ADS.enabled === true && !!ADS.publisherId && consentGranted();
    }

    function injectAd(box, slotId) {
        if (box.getAttribute('data-ad-state') === 'done') return;
        box.setAttribute('data-ad-state', 'done');
        box.classList.add('ad-on');

        box.innerHTML =
            '<ins class="adsbygoogle" style="display:block;width:100%"' +
            ' data-ad-client="' + ADS.publisherId + '"' +
            ' data-ad-slot="' + slotId + '"' +
            ' data-ad-format="' + (box.getAttribute('data-ad-format') || 'auto') + '"' +
            ' data-full-width-responsive="true"></ins>';

        window.requestAnimationFrame(function () {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        });

        // 未填充成功（被拦截插件挡掉等）时收起空位，避免留白
        setTimeout(function () {
            var ins = box.querySelector('ins.adsbygoogle');
            if (ins && ins.getAttribute('data-ad-status') === 'unfilled') {
                box.classList.add('ad-empty');
            }
        }, 4000);
    }

    function observeAd(box, slotId) {
        if (!('IntersectionObserver' in window)) {
            injectAd(box, slotId);
            return;
        }
        if (!adObserver) {
            adObserver = new IntersectionObserver(function (entries) {
                for (var i = 0; i < entries.length; i++) {
                    if (entries[i].isIntersecting) {
                        var el = entries[i].target;
                        adObserver.unobserve(el);
                        injectAd(el, el.__adSlotId);
                    }
                }
            }, { rootMargin: '250px 0px' });
        }
        box.__adSlotId = slotId;
        adObserver.observe(box);
    }

    function paintPlaceholder(box) {
        if (box.getAttribute('data-ad-state') === 'done') return;
        box.setAttribute('data-ad-state', 'done');
        box.classList.add('ad-on', 'ad-test');
        box.textContent = '广告位预览：' + box.getAttribute('data-ad-slot') + '（testMode）';
    }

    function renderSlots() {
        var boxes = document.querySelectorAll('[data-ad-slot]');
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];
            if (box.getAttribute('data-ad-state')) continue;

            if (ADS.testMode === true) { paintPlaceholder(box); continue; }
            if (!adsReady()) continue;

            var slotId = (ADS.slots || {})[box.getAttribute('data-ad-slot')];
            if (!slotId) continue;

            box.setAttribute('data-ad-state', 'pending');
            observeAd(box, slotId);
        }
    }

    /* =========================================================
     * 5. Cookie 同意横幅
     * ======================================================= */
    function buildBanner() {
        if (CONSENT.enabled === false || consentChoice || !document.body) return;

        var bar = document.createElement('div');
        bar.className = 'cookie-bar';
        bar.setAttribute('role', 'dialog');
        bar.setAttribute('aria-live', 'polite');
        bar.setAttribute('aria-label', 'Cookie 使用提示');
        bar.innerHTML =
            '<div class="cookie-bar-inner">' +
            '<p class="cookie-bar-text">' + (CONSENT.text || '') +
            ' <a href="' + (CONSENT.privacyUrl || '/privacy.html') + '">了解更多</a></p>' +
            '<div class="cookie-bar-actions">' +
            '<button type="button" class="cookie-btn cookie-btn-ghost" data-consent="denied">' +
            (CONSENT.rejectText || '仅必要') + '</button>' +
            '<button type="button" class="cookie-btn cookie-btn-primary" data-consent="granted">' +
            (CONSENT.acceptText || '接受') + '</button>' +
            '</div></div>';

        bar.addEventListener('click', function (e) {
            var btn = closest(e.target, '[data-consent]');
            if (!btn) return;
            var choice = btn.getAttribute('data-consent');
            consentChoice = choice;
            store(CONSENT_KEY, choice);
            gtag('consent', 'update', consentPayload(choice));
            if (bar.parentNode) bar.parentNode.removeChild(bar);
            if (document.body) document.body.classList.remove('has-cookie-bar');
            if (choice === 'granted') startThirdParty();
        });

        document.body.appendChild(bar);
        document.body.classList.add('has-cookie-bar');
    }

    /* =========================================================
     * 6. SEO 标签注入（页面里已写过的不会被覆盖）
     * ======================================================= */
    function injectMeta(attr, name, content) {
        if (!content) return;
        if (document.querySelector('meta[' + attr + '="' + name + '"]')) return;
        var m = document.createElement('meta');
        m.setAttribute(attr, name);
        m.setAttribute('content', content);
        document.head.appendChild(m);
    }

    function injectSeo() {
        var url = pageUrl();
        var title = document.title;
        var desc = metaContent('description');
        var isArticle = metaContent('page-type') === 'article';

        if (!document.querySelector('link[rel="canonical"]')) {
            var l = document.createElement('link');
            l.rel = 'canonical';
            l.href = url;
            document.head.appendChild(l);
        }

        injectMeta('property', 'og:url', url);
        injectMeta('property', 'og:type', isArticle ? 'article' : 'website');
        injectMeta('property', 'og:site_name', CFG.siteName);
        injectMeta('property', 'og:locale', CFG.locale || 'zh_CN');
        injectMeta('property', 'og:title', title);
        injectMeta('property', 'og:description', desc);
        injectMeta('property', 'og:image', absUrl(CFG.shareImage));
        injectMeta('name', 'twitter:card', 'summary_large_image');
        injectMeta('name', 'twitter:title', title);
        injectMeta('name', 'twitter:description', desc);
        injectMeta('name', 'twitter:image', absUrl(CFG.shareImage));
    }

    function injectArticleSchema() {
        if (metaContent('page-type') !== 'article') return;
        var data = {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: document.title.split(/[-_|]/)[0].replace(/\s+$/, ''),
            description: metaContent('description'),
            inLanguage: 'zh-CN',
            mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl() },
            image: [absUrl(CFG.shareImage)],
            author: { '@type': 'Organization', name: CFG.siteName },
            publisher: {
                '@type': 'Organization',
                name: CFG.siteName,
                logo: { '@type': 'ImageObject', url: absUrl('/images/logo.png') }
            }
        };
        // 文章页如果填了 <meta name="page-published" content="2026-01-15">，
        // 会一并写进结构化数据
        var published = metaContent('page-published');
        if (published) {
            data.datePublished = published;
            data.dateModified = published;
        }
        var s = document.createElement('script');
        s.type = 'application/ld+json';
        s.textContent = JSON.stringify(data);
        document.head.appendChild(s);
    }

    function injectContact() {
        var email = (CFG.contact || {}).email;
        if (!email) return;
        var nodes = document.querySelectorAll('[data-site-email]');
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].textContent = email;
            nodes[i].setAttribute('href', 'mailto:' + email);
        }
    }

    /* =========================================================
     * 7. 启动
     * ======================================================= */
    function boot() {
        injectSeo();
        injectArticleSchema();
        injectContact();
        buildBanner();

        if (consentGranted()) {
            startThirdParty();
        } else {
            renderSlots();  // testMode 预览用；未同意时不渲染
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // 供调试用
    window.SITE = {
        config: CFG,
        renderSlots: renderSlots,
        resetConsent: function () {
            try { window.localStorage.removeItem(CONSENT_KEY); } catch (e) {}
        }
    };
})();
