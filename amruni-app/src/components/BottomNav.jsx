import { motion } from 'framer-motion';

export default function BottomNav({ tabs, active, onTab }) {
  return (
    <nav className="bottom-nav" role="tablist">
      {tabs.map(({ path, label, icon: Icon }) => {
        const isActive = active === path;
        return (
          <button
            key={path}
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            className={`bottom-nav__tab${isActive ? ' bottom-nav__tab--active' : ''}`}
            onClick={() => onTab(path)}
          >
            <motion.div
              className="bottom-nav__tab-icon"
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <Icon active={isActive} />
            </motion.div>
            <span className="bottom-nav__tab-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
