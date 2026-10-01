import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, Heart, User, ClipboardList } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export const CustomerLayout = () => {
  const location = useLocation();
  const { totalItemCount } = useCart();
  const { wishlist } = useWishlist();

  const customerNav = [
    { label: 'Marketplace', path: '/marketplace', icon: ShoppingBag },
    { label: 'My Cart', path: '/cart', icon: ShoppingCart, count: totalItemCount },
    { label: 'Orders', path: '/orders', icon: ClipboardList },
    { label: 'Wishlist', path: '/wishlist', icon: Heart, count: wishlist?.length },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="relative pb-16 md:pb-0">
      <PublicLayout />

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 md:hidden flex justify-around py-2 px-1 shadow-lg">
        {customerNav.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg relative text-xs ${
                isActive ? 'text-brand-600 font-bold' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.count > 0 && (
                  <span className="absolute -top-1 -right-2 bg-brand-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {item.count}
                  </span>
                )}
              </div>
              <span className="mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
