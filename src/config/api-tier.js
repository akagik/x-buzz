import config from './index.js';
import logger from '../utils/logger.js';

export const API_TIERS = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
};

export const TIER_CAPABILITIES = {
  [API_TIERS.FREE]: {
    canPost: true,
    canSearch: false,
    canReadTimelines: false,
    canFollow: false,
    canLike: false,
    canGetUsers: false,
    canGetTrends: false,
    canUploadMedia: true, // Until March 31, 2025
    description: 'Free tier - Only posting tweets allowed'
  },
  [API_TIERS.BASIC]: {
    canPost: true,
    canSearch: true,
    canReadTimelines: true,
    canFollow: true,
    canLike: true,
    canGetUsers: true,
    canGetTrends: true,
    canUploadMedia: true,
    description: 'Basic tier ($100/month) - Full read/write access'
  },
  [API_TIERS.PRO]: {
    canPost: true,
    canSearch: true,
    canReadTimelines: true,
    canFollow: true,
    canLike: true,
    canGetUsers: true,
    canGetTrends: true,
    canUploadMedia: true,
    description: 'Pro tier - Enhanced rate limits and features'
  },
  [API_TIERS.ENTERPRISE]: {
    canPost: true,
    canSearch: true,
    canReadTimelines: true,
    canFollow: true,
    canLike: true,
    canGetUsers: true,
    canGetTrends: true,
    canUploadMedia: true,
    description: 'Enterprise tier - Maximum capabilities'
  }
};

class ApiTierManager {
  constructor() {
    this.currentTier = config.twitter.apiTier || API_TIERS.FREE;
    logger.info(`Twitter API Tier: ${this.currentTier}`, {
      capabilities: this.getCapabilities()
    });
  }

  getTier() {
    return this.currentTier;
  }

  getCapabilities() {
    return TIER_CAPABILITIES[this.currentTier] || TIER_CAPABILITIES[API_TIERS.FREE];
  }

  canPerformAction(action) {
    const capabilities = this.getCapabilities();
    const capabilityKey = `can${action.charAt(0).toUpperCase() + action.slice(1)}`;
    return capabilities[capabilityKey] || false;
  }

  requireCapability(action) {
    if (!this.canPerformAction(action)) {
      throw new Error(
        `Action '${action}' requires ${API_TIERS.BASIC} tier or higher. ` +
        `Current tier: ${this.currentTier}. ` +
        `Please upgrade at https://developer.x.com/en/portal/products`
      );
    }
  }

  handleApiError(error, action) {
    if (error.code === 403 || (error.data && error.data.status === 403)) {
      logger.warn(`API access denied for action '${action}' on ${this.currentTier} tier`, {
        error: error.message,
        suggestion: `Upgrade to ${API_TIERS.BASIC} tier for this feature`
      });
      return {
        success: false,
        error: `This feature requires ${API_TIERS.BASIC} tier or higher`,
        currentTier: this.currentTier,
        requiredTier: API_TIERS.BASIC,
        upgradeUrl: 'https://developer.x.com/en/portal/products'
      };
    }
    throw error;
  }
}

export default new ApiTierManager();