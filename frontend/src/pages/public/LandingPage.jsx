import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Clock, ShieldCheck, ArrowRight, TrendingDown, Store, Leaf, ShoppingBag } from 'lucide-react';
import { productService } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { ProductCard } from '../../components/common/ProductCard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ScrollBanners } from '../../components/home/ScrollBanners';
import { WhyChooseNearExpiry } from '../../components/home/WhyChooseNearExpiry';

export const LandingPage = () => {
  const [urgentDeals, setUrgentDeals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch near-expiry deals (0-7 days window, sorted by expiry ascending)
        const [prodData, catData] = await Promise.all([
          productService.getMarketplaceProducts({ limit: 8, sortBy: 'expiry', sortOrder: 'asc' }),
          categoryService.getCategories({ status: 'ACTIVE' }),
        ]);
        setUrgentDeals(prodData?.products || []);
        setCategories(catData?.categories?.slice(0, 6) || (Array.isArray(catData) ? catData.slice(0, 6) : []));
      } catch (err) {
        console.warn('Failed to load landing data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

      {/* Featured Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Explore by Category</h2>
              <p className="text-sm text-gray-500">Find rescue specials in your neighborhood stores</p>
            </div>
            <Link to="/marketplace" className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat._id}
                to={`/marketplace?category=${cat._id}`}
                className="bg-white p-4 rounded-xl border border-gray-200 text-center hover:border-brand-500 hover:shadow-md transition group"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg mb-2 group-hover:scale-110 transition">
                  {cat.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-xs font-semibold text-gray-800 line-clamp-1">{cat.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

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

      {/* Interactive Why Choose NearExpiry Section */}
      <WhyChooseNearExpiry />

      {/* How It Works */}
      <section id="how-it-works" className="bg-white py-16 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-black text-gray-900">How NearExpiry Works</h2>
            <p className="text-sm text-gray-500 mt-2">
              Our automated First-Expired-First-Out (FEFO) engine recalculates dynamic pricing every 24 hours.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-black text-xl mb-4">
                1
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">Stores Register Batches</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Supermarkets register stock with exact manufacturing & expiry dates. Every batch receives a unique cryptographic QR token.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xl mb-4">
                2
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">Dynamic Algorithm Discounts</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                As expiry dates draw nearer, prices drop automatically (10% → 25% → 40% → 60% → 75%). Safe food never goes to waste.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xl mb-4">
                3
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">Pickup or Local Delivery</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Shoppers order directly, saving hundreds of rupees. Stores mark orders ready and avoid write-off inventory losses.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
