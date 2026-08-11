/**
 * Shared Dark/Light Theme Engine for Flame Dine
 * Persists the choice in localStorage so it's consistent across every
 * portal (login, Kitchen, Server, Admin) without needing to re-select it.
 * Must be loaded synchronously (no `defer`) and as early as possible in
 * <head> so the correct theme applies before first paint (no flash).
 */
(function (window) {
    const KEY = 'flame_dine_theme';

    function get() {
        return localStorage.getItem(KEY) || 'dark';
    }

    function apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    function set(theme) {
        localStorage.setItem(KEY, theme);
        apply(theme);
        window.dispatchEvent(new CustomEvent('flamedine-theme-changed', { detail: { theme } }));
    }

    function toggle() {
        const next = get() === 'dark' ? 'light' : 'dark';
        set(next);
        return next;
    }

    // Apply immediately so there is no flash of the wrong theme.
    apply(get());

    // Sync across tabs (e.g. toggled on Kitchen, Server tab picks it up).
    window.addEventListener('storage', (e) => {
        if (e.key === KEY && e.newValue) apply(e.newValue);
    });

    // Wires a <button><i id="{iconId}"></i></button> to reflect/toggle the theme.
    // Call after the button exists in the DOM (e.g. on DOMContentLoaded).
    function wireToggleButton(buttonId, iconId) {
        const btn = document.getElementById(buttonId);
        const icon = document.getElementById(iconId);
        if (!btn || !icon) return;
        const paint = () => {
            icon.className = get() === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        };
        paint();
        btn.addEventListener('click', () => {
            toggle();
            paint();
        });
        window.addEventListener('flamedine-theme-changed', paint);
    }

    window.FlameDineTheme = { get, set, apply, toggle, wireToggleButton };
})(window);
