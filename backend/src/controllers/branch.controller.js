import { ApiResponse } from '../utils/ApiResponse.js';
import {
  getMyBranchesService,
  getStoreBranchesService,
  getActiveBranchesService,
  createBranchService,
  updateBranchService,
  toggleBranchStatusService,
  setPrimaryBranchService,
  getBranchInventoryService,
} from '../services/branch.service.js';

/**
 * 1. GET /api/v1/branches/my-branches
 * Seller retrieves all branches for their store.
 */
export const getMyBranches = async (req, res, next) => {
  try {
    const data = await getMyBranchesService(req.user);
    return res.status(200).json(
      new ApiResponse(200, 'Seller store branches retrieved successfully.', data)
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 2. GET /api/v1/branches/store/:storeId
 * Public or Customer retrieves active branches for a store.
 */
export const getStoreBranches = async (req, res, next) => {
  try {
    const data = await getStoreBranchesService(req.params.storeId, req.user, req.query);
    return res.status(200).json(
      new ApiResponse(200, 'Store branches retrieved successfully.', data)
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 2.1 GET /api/v1/branches/active
 * Public or Customer retrieves all active branches across approved stores.
 */
export const getActiveBranches = async (req, res, next) => {
  try {
    const branches = await getActiveBranchesService();
    return res.status(200).json(
      new ApiResponse(200, 'Active branches retrieved successfully.', branches)
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 3. POST /api/v1/branches
 * Seller creates a new branch for their store.
 */
export const createBranch = async (req, res, next) => {
  try {
    const branch = await createBranchService(req.user, req.body);
    return res.status(201).json(
      new ApiResponse(201, 'Branch created successfully.', branch)
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 4. PUT /api/v1/branches/:id
 * Seller or Admin updates a branch.
 */
export const updateBranch = async (req, res, next) => {
  try {
    const branch = await updateBranchService(req.params.id, req.user, req.body);
    return res.status(200).json(
      new ApiResponse(200, 'Branch updated successfully.', branch)
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 5. PATCH /api/v1/branches/:id/status
 * Seller or Admin toggles branch active/inactive.
 */
export const toggleBranchStatus = async (req, res, next) => {
  try {
    const branch = await toggleBranchStatusService(req.params.id, req.user, req.body.isActive);
    return res.status(200).json(
      new ApiResponse(200, `Branch ${req.body.isActive ? 'activated' : 'deactivated'} successfully.`, branch)
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 6. PATCH /api/v1/branches/:id/primary
 * Seller sets branch as the primary branch.
 */
export const setPrimaryBranch = async (req, res, next) => {
  try {
    const branch = await setPrimaryBranchService(req.params.id, req.user);
    return res.status(200).json(
      new ApiResponse(200, 'Branch set as primary branch successfully.', branch)
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 7. GET /api/v1/branches/:id/inventory
 * Seller or Admin inspects inventory lots dedicated to this branch.
 */
export const getBranchInventory = async (req, res, next) => {
  try {
    const data = await getBranchInventoryService(req.params.id, req.user);
    return res.status(200).json(
      new ApiResponse(200, 'Branch inventory telemetry retrieved successfully.', data)
    );
  } catch (err) {
    next(err);
  }
};

