import React, { useState, useEffect, useRef } from 'react';
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
 * Interactive premium dark section highlighting the 3 pillars of NearExpiry:
 * 1. For Sellers (Monetization, Batch & Expiry management, Dynamic pricing)
 * 2. For Buyers (Curated discounts, transparent expiry, nearby deals)
 * 3. For Everyone (Zero waste, circular economy, sustainability)
 *
 * Features:
 * - Ambient dark/purple glow background
 * - Glassmorphic gradient cards with rounded corners
 * - Interactive hover lift + soft glow + icon micro-animation on desktop
 * - Tappable accordion expansion on mobile & desktop
 * - Viewport scroll-reveal with prefers-reduced-motion support
 * - Reuses existing routes (/register-seller, /marketplace, #how-it-works)
 */
export const WhyChooseNearExpiry = () => {
  // Track active expanded card: 'sellers' | 'buyers' | 'everyone' | null
  const [activeCard, setActiveCard] = useState('sellers');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  // Scroll reveal with IntersectionObserver
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

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
      badgeColor: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30',
      icon: Store,
      iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-400/30',
      cardBorder: 'border-emerald-500/25 hover:border-emerald-400/50',
      activeRing: 'ring-2 ring-emerald-400/70 shadow-[0_0_35px_rgba(16,185,129,0.25)]',
      glowColor: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]',
      title: 'Monetize & Eliminate Loss',
      tagline: 'Turn products approaching expiry into immediate revenue instead of waste.',
      ctaText: 'Become a Seller',
      ctaTo: '/register-seller',
      ctaType: 'link',
      ctaBtnStyle: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold',
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
      badgeColor: 'text-amber-300 bg-amber-500/15 border-amber-400/30',
      icon: ShoppingBag,
      iconColor: 'text-amber-400 bg-amber-500/15 border-amber-400/30',
      cardBorder: 'border-amber-500/25 hover:border-amber-400/50',
      activeRing: 'ring-2 ring-amber-400/70 shadow-[0_0_35px_rgba(245,158,11,0.25)]',
      glowColor: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]',
      title: 'Save Big on Fresh Goods',
      tagline: 'Find top-tier groceries and household essentials at up to 75% off.',
      ctaText: 'Explore Deals',
      ctaTo: '/marketplace',
      ctaType: 'link',
      ctaBtnStyle: 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold',
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
      badgeColor: 'text-purple-300 bg-purple-500/15 border-purple-400/30',
      icon: Globe,
      iconColor: 'text-purple-400 bg-purple-500/15 border-purple-400/30',
      cardBorder: 'border-purple-500/25 hover:border-purple-400/50',
      activeRing: 'ring-2 ring-purple-400/70 shadow-[0_0_35px_rgba(168,85,247,0.25)]',
      glowColor: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]',
      title: 'Sustainable Circular Economy',
      tagline: 'Keep useful goods circulating longer and eliminate unnecessary waste.',
      ctaText: 'Learn How It Works',
      ctaTo: '#how-it-works',
      ctaType: 'anchor',
      ctaBtnStyle: 'bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold',
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
      ref={sectionRef}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative my-12"
      aria-label="Why Choose NearExpiry"
    >
      {/* Outer Shell with Premium Dark / Purple Background */}
      <div className="relative rounded-3xl bg-slate-950 text-white p-6 sm:p-10 md:p-14 lg:p-16 overflow-hidden border border-purple-900/40 shadow-2xl">
        {/* Ambient Gradient Glow Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Block with Scroll Reveal Animation */}
        <div
          className={`relative z-10 text-center max-w-3xl mx-auto mb-12 sm:mb-16 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-xs font-semibold text-purple-200 mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            The NearExpiry Advantage
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Why Choose NearExpiry?
          </h2>

          <p className="text-base sm:text-lg text-purple-200/80 font-medium mt-3 leading-relaxed">
            Built for Sellers. Better for Buyers. Smarter for Everyone.
          </p>

          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            Click any card to expand full benefits & ecosystem capabilities
          </p>
        </div>

        {/* 3 Interactive Feature Cards */}
        <div
          className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start group/deck"
        >
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            const isExpanded = activeCard === pillar.id;
            const isHovered = hoveredCard === pillar.id;
            const delayClass =
              index === 0
                ? 'delay-100'
                : index === 1
                ? 'delay-200'
                : 'delay-300';

            return (
              <div
                key={pillar.id}
                onMouseEnter={() => setHoveredCard(pillar.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`transition-all duration-700 ease-out ${delayClass} ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                } ${
                  hoveredCard && !isHovered ? 'lg:opacity-85' : 'opacity-100'
                }`}
              >
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
                  className={`relative rounded-2xl p-6 sm:p-7 backdrop-blur-xl bg-slate-900/80 border text-left cursor-pointer transition-all duration-300 transform group hover:-translate-y-2 select-none ${
                    pillar.cardBorder
                  } ${pillar.glowColor} ${
                    isExpanded ? pillar.activeRing : 'shadow-lg'
                  }`}
                >
                  {/* Card Header: Badge + Toggle Hint */}
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border backdrop-blur-md ${pillar.badgeColor}`}
                    >
                      {pillar.badge}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-white transition">
                      <span>{isExpanded ? 'Collapse' : 'Details'}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180 text-amber-300' : 'text-gray-400'
                        }`}
                      />
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${pillar.iconColor}`}
                    >
                      <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                        {pillar.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-300/90 mt-1 leading-relaxed">
                        {pillar.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/10 my-4" />

                  {/* Benefits List (Expandable) */}
                  <div className="space-y-3.5">
                    {/* Always show first 2 items; show remaining 3 when expanded */}
                    {pillar.benefits.map((benefit, bIdx) => {
                      const isExtra = bIdx >= 2;
                      if (isExtra && !isExpanded) return null;

                      return (
                        <div
                          key={benefit.title}
                          className={`flex items-start gap-3 transition-opacity duration-300 ${
                            isExtra ? 'animate-fadeIn' : ''
                          }`}
                        >
                          <CheckCircle2
                            className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                              pillar.id === 'sellers'
                                ? 'text-emerald-400'
                                : pillar.id === 'buyers'
                                ? 'text-amber-400'
                                : 'text-purple-400'
                            }`}
                          />
                          <div>
                            <div className="text-sm font-semibold text-white/95 leading-tight">
                              {benefit.title}
                            </div>
                            <div className="text-xs text-gray-300/85 mt-0.5 leading-relaxed">
                              {benefit.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Expansion indicator preview for collapsed cards */}
                  {!isExpanded && (
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400 font-medium group-hover:text-amber-300 transition">
                      <span>+3 more capabilities</span>
                      <span className="flex items-center gap-1 font-semibold">
                        Tap to expand <ChevronDown className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  )}

                  {/* Expanded CTA Action (uses existing routes only) */}
                  {isExpanded && (
                    <div
                      className="mt-6 pt-5 border-t border-white/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pillar.ctaType === 'link' ? (
                        <Link
                          to={pillar.ctaTo}
                          className={`w-full py-3 px-5 rounded-xl transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm ${pillar.ctaBtnStyle}`}
                        >
                          {pillar.ctaText}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <a
                          href={pillar.ctaTo}
                          onClick={handleScrollToHowItWorks}
                          className={`w-full py-3 px-5 rounded-xl transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm ${pillar.ctaBtnStyle}`}
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
