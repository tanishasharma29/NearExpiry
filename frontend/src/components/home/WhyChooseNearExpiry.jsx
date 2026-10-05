import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  ShoppingBag,
  Globe,
  Sparkles,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

/**
 * WhyChooseNearExpiry
 *
 * Styled to 100% match NearExpiry's Seller/Admin Dashboard palette:
 * - Background: bg-gradient-to-r from-slate-900 to-slate-800 (identical to Store Command Hub)
 * - Badges: uppercase tracking-wider text-amber-400 / text-brand-400
 * - Neutral dark cards: bg-slate-800/80 border border-slate-700 (clean, no neon)
 * - Accent CTA buttons: bg-brand-600 & bg-amber-400 (matching dashboard action buttons)
 * - Active card: border-brand-500/80 ring-1 ring-brand-500/30 (NearExpiry green accent)
 */
export const WhyChooseNearExpiry = () => {
  // Track active expanded card: 'sellers' | 'buyers' | 'everyone' | null
  const [activeCard, setActiveCard] = useState('sellers');

  const handleCardToggle = (id) => {
    setActiveCard((prev) => (prev === id ? null : id));
  };

  const handleScrollToHowItWorks = (e) => {
    e.preventDefault();
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const pillars = [
    {
      id: 'sellers',
      badge: 'FOR SELLERS',
      badgeClass: 'text-brand-400 bg-brand-500/10 border-brand-500/25',
      icon: Store,
      iconColor: 'text-brand-400',
      title: 'Monetize & Eliminate Loss',
      tagline: 'Turn products approaching expiry into immediate revenue instead of waste.',
      ctaText: 'Become a Seller',
      ctaTo: '/register-seller',
      ctaType: 'link',
      ctaBtnStyle: 'bg-brand-600 hover:bg-brand-500 text-white font-bold',
      benefits: [
        {
          title: 'Monetize Near-Expiry Inventory',
          desc: 'Turn products approaching expiry into revenue instead of waste.',
        },
        {
          title: 'Easy Product & Batch Management',
          desc: 'Manage products, batches, stock, pricing and expiry information.',
        },
        {
          title: 'Smart Pricing',
          desc: 'Dynamic discounts help move inventory before expiry.',
        },
        {
          title: 'Inventory & Expiry Visibility',
          desc: 'Track stock and identify products approaching expiry.',
        },
        {
          title: 'Order Management',
          desc: 'Manage customer orders through the seller portal.',
        },
      ],
    },
    {
      id: 'buyers',
      badge: 'FOR BUYERS',
      badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
      icon: ShoppingBag,
      iconColor: 'text-amber-400',
      title: 'Save Big on Fresh Goods',
      tagline: 'Find top-tier groceries and household essentials at up to 75% off.',
      ctaText: 'Explore Deals',
      ctaTo: '/marketplace',
      ctaType: 'link',
      ctaBtnStyle: 'bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold',
      benefits: [
        {
          title: 'Discover Discounted Products',
          desc: 'Find quality products available at reduced prices.',
        },
        {
          title: 'Transparent Pricing',
          desc: 'See current prices and applicable discounts clearly.',
        },
        {
          title: 'Expiry Awareness',
          desc: 'Clearly understand product expiry information before purchasing.',
        },
        {
          title: 'Nearby Deals',
          desc: 'Discover relevant products/stores based on marketplace availability.',
        },
        {
          title: 'Secure Checkout',
          desc: 'Add products to cart and complete purchases through the existing checkout flow.',
        },
      ],
    },
    {
      id: 'everyone',
      badge: 'FOR EVERYONE',
      badgeClass: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
      icon: Globe,
      iconColor: 'text-emerald-400',
      title: 'Sustainable Circular Economy',
      tagline: 'Keep useful goods circulating longer and eliminate unnecessary waste.',
      ctaText: 'Learn How It Works',
      ctaTo: '#how-it-works',
      ctaType: 'anchor',
      ctaBtnStyle: 'bg-slate-700 hover:bg-slate-600 text-white font-bold border border-slate-600',
      benefits: [
        {
          title: 'Reduce Food & Product Waste',
          desc: 'Help prevent usable products from becoming waste.',
        },
        {
          title: 'Save Money',
          desc: 'Buyers get better prices while sellers recover value from inventory.',
        },
        {
          title: 'Support a Circular Economy',
          desc: 'Keep useful products in circulation for longer.',
        },
        {
          title: 'Transparent Marketplace',
          desc: 'Clear product, price, stock and expiry information.',
        },
        {
          title: 'Sustainable Shopping',
          desc: 'Make smarter purchases while helping reduce unnecessary waste.',
        },
      ],
    },
  ];

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-12"
      aria-label="Why Choose NearExpiry"
    >
      {/* Container with Dashboard-matched Slate Gradient (from-slate-900 to-slate-800) */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 sm:p-10 md:p-14 border border-slate-800 shadow-xl">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            The NearExpiry Advantage
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Why Choose NearExpiry?
          </h2>

          <p className="text-base sm:text-lg text-slate-300 font-medium mt-3 leading-relaxed">
            Built for Sellers. Better for Buyers. Smarter for Everyone.
          </p>

          <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
            Click any card to expand full benefits & ecosystem capabilities
          </p>
        </div>

        {/* 3 Interactive Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            const isExpanded = activeCard === pillar.id;

            return (
              <div key={pillar.id} className="transition-all duration-300">
                <div
                  onClick={() => handleCardToggle(pillar.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardToggle(pillar.id);
                    }
                  }}
                  className={`rounded-2xl p-6 sm:p-7 text-left cursor-pointer transition-all duration-300 select-none border ${
                    isExpanded
                      ? 'bg-slate-800/95 border-brand-500/80 ring-1 ring-brand-500/30 shadow-xl'
                      : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800/90 hover:border-slate-600 hover:-translate-y-1 hover:shadow-lg'
                  }`}
                >
                  {/* Card Header: Badge + Details indicator */}
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border ${pillar.badgeClass}`}
                    >
                      {pillar.badge}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white transition">
                      <span>{isExpanded ? 'Collapse' : 'Details'}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-amber-400' : 'text-slate-400'
                        }`}
                      />
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center flex-shrink-0 shadow-inner">
                      <Icon className={`w-6 h-6 ${pillar.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                        {pillar.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                        {pillar.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-700/70 my-4" />

                  {/* Benefits List (Expandable) */}
                  <div className="space-y-3">
                    {pillar.benefits.map((benefit, bIdx) => {
                      const isExtra = bIdx >= 2;
                      if (isExtra && !isExpanded) return null;

                      return (
                        <div
                          key={benefit.title}
                          className="flex items-start gap-3 transition-opacity duration-200"
                        >
                          <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="text-sm font-semibold text-white leading-tight">
                              {benefit.title}
                            </div>
                            <div className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                              {benefit.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Preview label when collapsed */}
                  {!isExpanded && (
                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>+3 more benefits</span>
                      <span className="flex items-center gap-1 font-semibold text-amber-400">
                        Click to expand <ChevronDown className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  )}

                  {/* Expanded CTA Action */}
                  {isExpanded && (
                    <div
                      className="mt-6 pt-5 border-t border-slate-700/70"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pillar.ctaType === 'link' ? (
                        <Link
                          to={pillar.ctaTo}
                          className={`w-full py-3 px-5 rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm ${pillar.ctaBtnStyle}`}
                        >
                          {pillar.ctaText}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <a
                          href={pillar.ctaTo}
                          onClick={handleScrollToHowItWorks}
                          className={`w-full py-3 px-5 rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm ${pillar.ctaBtnStyle}`}
                        >
                          {pillar.ctaText}
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseNearExpiry;
