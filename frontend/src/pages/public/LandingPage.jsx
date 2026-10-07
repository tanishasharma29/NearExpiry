import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Clock,
  ShieldCheck,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Store,
  Leaf,
  ShoppingBag,
  PackageOpen,
} from 'lucide-react';
import { productService } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { ProductCard } from '../../components/common/ProductCard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ScrollBanners } from '../../components/home/ScrollBanners';
import { PromotionalBannerSection } from '../../components/home/PromotionalBannerSection';
import { WhyChooseNearExpiry } from '../../components/home/WhyChooseNearExpiry';
import { HowItWorksSection } from '../../components/home/HowItWorksSection';

const CURATED_CATEGORIES = [
  {
    key: 'dairy-eggs',
    name: 'Dairy & Eggs',
    tagline: 'Fresh Milk, Curd, Butter & Cheeses',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
    description: 'Farm fresh milk, yogurts, butter, paneer, and eggs at unbeatable markdown prices.',
    badge: 'Fresh Deals',
  },
  {
    key: 'bakery-bread',
    name: 'Bakery & Bread',
    tagline: 'Pav, Artisan Breads & Tea Bakes',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    description: 'Fresh daily baked loaves, buns, croissants, and cookies from neighborhood bakeries.',
    badge: 'Daily Fresh',
  },
  {
    key: 'beverages-juices',
    name: 'Beverages & Juices',
    tagline: 'Cold Juices, Soft Drinks & Brews',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
    description: 'Cold-pressed juices, iced teas, soft drinks, milkshakes, and specialty roasted coffees.',
    badge: 'Refreshing',
  },
  {
    key: 'meat-seafood-poultry',
    name: 'Meat, Seafood & Poultry',
    tagline: 'Fresh Cuts, Farm Poultry & Catch',
    image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
    description: 'Hygienically prepped chicken, tender mutton cuts, fresh fish, and farm protein.',
    badge: 'Protein Rich',
  },
  {
    key: 'pantry-staples',
    name: 'Pantry & Staples',
    tagline: 'Rice, Atta, Pulses & Pure Oils',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    description: 'Everyday kitchen essentials, aged basmati rice, lentils, organic flours, and cooking oils.',
    badge: 'Staples',
  },
  {
    key: 'packaged-instant-foods',
    name: 'Packaged & Instant Foods',
    tagline: 'Noodles, Pasta, Cereals & Spreads',
    image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80',
    description: 'Instant ramen, breakfast muesli, gourmet pasta, sandwich spreads, and ready-to-cook meals.',
    badge: 'Instant',
  },
  {
    key: 'chocolates-sweets',
    name: 'Chocolates & Sweets',
    tagline: 'Dark Chocolates, Mithai & Desserts',
    image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80',
    description: 'Artisan cocoa bars, Indian sweets, assorted gift boxes, and confectionery delights.',
    badge: 'Sweet Tooth',
  },
  {
    key: 'personal-care-household',
    name: 'Personal Care & Household',
    tagline: 'Bath Soaps, Sanitizers & Cleaners',
    image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80',
    description: 'Eco dishwashing liquids, body washes, laundry detergents, and everyday home care.',
    badge: 'Essential',
  },
  {
    key: 'medicine',
    name: 'Medicine',
    tagline: 'First Aid, OTC Relief & Wellness',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    description: 'Over-the-counter essentials, daily vitamins, first-aid bandages, and healthcare items.',
    badge: 'Healthcare',
  },
];

export const LandingPage = () => {
  const [urgentDeals, setUrgentDeals] = useState([]);
  const [categories, setCategories] = useState(CURATED_CATEGORIES);
  const [activeCategoryKey, setActiveCategoryKey] = useState('dairy-eggs');
  const [categoryProducts, setCategoryProducts] = useState({});
  const [loadingCatProducts, setLoadingCatProducts] = useState(false);
  const [loading, setLoading] = useState(true);
  const categoryCarouselRef = useRef(null);

  // Active category object
  const activeCategory =
    categories.find((c) => c.key === activeCategoryKey) || categories[0] || CURATED_CATEGORIES[0];
  const currentCatDeals = categoryProducts[activeCategoryKey] || [];

  // Fetch initial landing data (Urgent deals & matching active categories)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch near-expiry deals (0-7 days window, sorted by expiry ascending)
        const [prodData, catData] = await Promise.all([
          productService.getMarketplaceProducts({ limit: 8, sortBy: 'expiry', sortOrder: 'asc' }),
          categoryService.getCategories({ status: 'ACTIVE', limit: 100 }),
        ]);
        setUrgentDeals(prodData?.products || []);

        const rawList = catData?.categories || (Array.isArray(catData) ? catData : []);
        const cleanList = rawList.filter((c) => {
          if (!c.name) return false;
          const n = c.name.trim();
          if (/^Admin Category/i.test(n)) return false;
          if (/^Notif /i.test(n)) return false;
          if (/^QR /i.test(n)) return false;
          if (/\d{6,}/.test(n)) return false;
          return true;
        });

        const mapped = CURATED_CATEGORIES.map((curated) => {
          const match = cleanList.find(
            (c) =>
              c.name.toLowerCase() === curated.name.toLowerCase() ||
              c.slug === curated.key ||
              c.slug?.includes(curated.key.replace(/-/g, ''))
          );
          if (!match) return null;
          return {
            ...curated,
            _id: match._id,
            slug: match.slug || curated.key,
          };
        }).filter(Boolean);

        setCategories(
          mapped.length > 0
            ? mapped
            : cleanList.map((c) => ({
                key: c.slug,
                name: c.name,
                _id: c._id,
                slug: c.slug,
                tagline: c.description,
                description: c.description,
                image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
                badge: 'Deals',
              }))
        );

        // Pre-fetch initial category products for instant display
        const defaultCat = mapped.find((c) => c.key === activeCategoryKey) || mapped[0];
        if (defaultCat?._id) {
          try {
            const catProdRes = await productService.getMarketplaceProducts({
              category: defaultCat._id,
              limit: 12,
            });
            setCategoryProducts({
              [defaultCat.key]: catProdRes?.products || [],
            });
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Failed to load landing data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch products for currently active category
  useEffect(() => {
    if (!activeCategory?._id) return;
    if (categoryProducts[activeCategory.key]) return;

    let isSubscribed = true;
    const fetchCategoryDeals = async () => {
      try {
        setLoadingCatProducts(true);
        const res = await productService.getMarketplaceProducts({
          category: activeCategory._id,
          limit: 12,
        });
        if (isSubscribed) {
          setCategoryProducts((prev) => ({
            ...prev,
            [activeCategory.key]: res?.products || [],
          }));
        }
      } catch (err) {
        console.warn('Failed to load products for category', err);
        if (isSubscribed) {
          setCategoryProducts((prev) => ({
            ...prev,
            [activeCategory.key]: [],
          }));
        }
      } finally {
        if (isSubscribed) {
          setLoadingCatProducts(false);
        }
      }
    };
    fetchCategoryDeals();
    return () => {
      isSubscribed = false;
    };
  }, [activeCategory?._id, activeCategory?.key, categoryProducts]);

  // Carousel scroll buttons
  const scrollCategoryCarousel = (direction) => {
    if (!categoryCarouselRef.current) return;
    const scrollAmount = 340;
    categoryCarouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-16 py-6">
      {/* Horizontal Scroll Multi-Banner Hero (Banner 1 + Banners 2-5) */}
      <ScrollBanners />

      {/* Impact Counters */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-3xl font-black text-brand-600">Up to 75%</div>
            <div className="text-xs font-medium text-gray-500 mt-1">Dynamic Expiry Discounts</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-3xl font-black text-emerald-600">100% FEFO</div>
            <div className="text-xs font-medium text-gray-500 mt-1">Strict Batch Integrity</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-3xl font-black text-amber-500">Real-Time</div>
            <div className="text-xs font-medium text-gray-500 mt-1">Automated Expiry Radar</div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-3xl font-black text-blue-600">Zero Waste</div>
            <div className="text-xs font-medium text-gray-500 mt-1">Food Waste Prevented</div>
          </div>
        </div>
      </section>

      {/* Explore by Category Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full mb-2 border border-emerald-200 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Curated Rescue Specials
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Explore by Category
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Browse high-demand essentials expiring soon with verified shelf-life & deep discounts
            </p>
          </div>

          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition group self-start md:self-auto"
          >
            <span>View All Deals</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition duration-200" />
          </Link>
        </div>

        {/* Customer-Facing Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
          {categories.map((cat) => {
            const isSelected = activeCategoryKey === cat.key;
            return (
              <div
                key={cat.key}
                onClick={() => setActiveCategoryKey(cat.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveCategoryKey(cat.key);
                  }
                }}
                className={`group relative bg-white rounded-2xl border cursor-pointer overflow-hidden transition-all duration-300 text-left flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-400/30 shadow-lg -translate-y-1'
                    : 'border-gray-200 hover:border-emerald-400 hover:shadow-md hover:-translate-y-1'
                }`}
              >
                {/* Category Image Header */}
                <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent opacity-80" />

                  {/* Badge Tag */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-emerald-700 shadow-sm border border-emerald-100">
                      {cat.badge}
                    </span>
                  </div>

                  {/* Active Indicator Pin */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 z-10">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between">
                  <div>
                    <h3
                      className={`font-bold text-base transition-colors ${
                        isSelected ? 'text-emerald-700' : 'text-gray-900 group-hover:text-emerald-600'
                      }`}
                    >
                      {cat.name}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-1 font-medium">{cat.tagline}</p>
                  </div>

                  {/* Footer Action */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span
                      className={`text-xs font-bold flex items-center gap-1 transition ${
                        isSelected ? 'text-emerald-600' : 'text-gray-600 group-hover:text-emerald-600'
                      }`}
                    >
                      Explore Deals
                      <ArrowRight
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isSelected ? 'translate-x-1 text-emerald-600' : 'group-hover:translate-x-1'
                        }`}
                      />
                    </span>

                    {isSelected && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Active View
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Category Products Carousel */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-sm">
          {/* Category Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-5 border-b border-gray-200/80 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-sm">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900">{activeCategory.name}</h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {loadingCatProducts ? 'Updating...' : `${currentCatDeals.length} deals`}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
                  {activeCategory.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              {/* Carousel Arrows */}
              {currentCatDeals.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => scrollCategoryCarousel('left')}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition"
                    title="Scroll Left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="h-4 w-px bg-gray-200" />
                  <button
                    onClick={() => scrollCategoryCarousel('right')}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition"
                    title="Scroll Right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {activeCategory._id && (
                <Link
                  to={`/marketplace?category=${activeCategory._id}`}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-50/50 border border-emerald-200 px-3.5 py-2 rounded-xl transition shadow-sm flex items-center gap-1"
                >
                  <span>Filter in Marketplace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>

          {/* Product Carousel Content */}
          {loadingCatProducts ? (
            <div className="py-16">
              <LoadingSpinner text={`Finding best discounts in ${activeCategory.name}...`} />
            </div>
          ) : currentCatDeals.length > 0 ? (
            <div
              ref={categoryCarouselRef}
              className="flex gap-5 overflow-x-auto scroll-smooth snap-x pb-2 pt-1 scrollbar-thin scrollbar-thumb-gray-200 focus:outline-none"
              style={{ scrollbarWidth: 'thin' }}
            >
              {currentCatDeals.map((product) => (
                <div
                  key={product._id}
                  className="w-[270px] sm:w-[290px] md:w-[305px] flex-shrink-0 snap-start"
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-dashed border-gray-300">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                <PackageOpen className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-gray-800">
                No deals available in this category yet.
              </h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-5">
                Local retail partners update near-expiry stock daily. Try switching categories or check
                all current flash deals in the marketplace.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to="/marketplace"
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition shadow-sm"
                >
                  Browse All Marketplace Deals
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Urgent Flash Deals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full mb-1 border border-red-200">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              Highest Discounts Active
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Urgent Near-Expiry Specials</h2>
            <p className="text-sm text-gray-500">Expiring in 1-7 days with 40% to 75% dynamic price drops</p>
          </div>
          <Link
            to="/marketplace?sortBy=discount&sortOrder=desc"
            className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            See More Deals <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner text="Locating nearby urgent lots..." />
        ) : urgentDeals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {urgentDeals.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-200 text-gray-500">
            No near-expiry deals currently live in this zone. Check back shortly!
          </div>
        )}
      </section>

      {/* Promotional CTA / Banner Section */}
      <PromotionalBannerSection />

      {/* Interactive Why Choose NearExpiry Section */}
      <WhyChooseNearExpiry />

      {/* How NearExpiry Works Section (Interactive Motion & Dashboard UI) */}
      <HowItWorksSection />
    </div>
  );
};

export default LandingPage;
