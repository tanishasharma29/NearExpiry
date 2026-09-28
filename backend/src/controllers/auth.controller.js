import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { env } from '../config/env.js';
import {
  registerCustomerService,
  registerSellerService,
  registerAdminService,
  loginUserService,
  getCurrentUserService,
  logoutUserService,
} from '../services/auth.service.js';

const setAuthCookie = (res, token) => {
  res.cookie('nearexpiry_token', token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const registerCustomer = asyncHandler(async (req, res) => {
  const { user, token } = await registerCustomerService(req.body);
  setAuthCookie(res, token);

  return res.status(201).json(
    new ApiResponse(201, 'Customer registered successfully', {
      user,
      token,
    })
  );
});

export const registerSeller = asyncHandler(async (req, res) => {
  const { user, token } = await registerSellerService(req.body);
  setAuthCookie(res, token);

  return res.status(201).json(
    new ApiResponse(
      201,
      'Seller registered successfully. Your store verification status is PENDING admin approval.',
      {
        user,
        token,
      }
    )
  );
});

export const registerAdmin = asyncHandler(async (req, res) => {
  const { user, token } = await registerAdminService(req.body);
  setAuthCookie(res, token);

  return res.status(201).json(
    new ApiResponse(201, 'Admin registered successfully', {
      user,
      token,
    })
  );
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await loginUserService(req.body);
  setAuthCookie(res, token);

  return res.status(200).json(
    new ApiResponse(200, 'Login successful', {
      user,
      token,
    })
  );
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await getCurrentUserService(req.user._id);

  return res.status(200).json(
    new ApiResponse(200, 'Current user profile fetched successfully', {
      user,
    })
  );
});

export const logout = asyncHandler(async (req, res) => {
  await logoutUserService(req.user._id);
  res.clearCookie('nearexpiry_token');

  return res.status(200).json(
    new ApiResponse(200, 'Logged out successfully. Active token has been revoked.')
  );
});
