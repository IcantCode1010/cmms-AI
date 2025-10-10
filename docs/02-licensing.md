# Licensing Model

## Overview

Atlas CMMS operates under a **dual-licensing model** allowing users to choose between:

1. **GNU General Public License v3 (GPLv3)** - Free and open source
2. **Commercial License** - Proprietary license for commercial use

## Open Source License (GPLv3)

### License File
See [LICENSE](../LICENSE) in the root directory.

### What GPLv3 Allows

✅ **Free Use**: Use Atlas CMMS for free without licensing costs
✅ **Internal Business Operations**: Deploy for internal maintenance management
✅ **Modification**: Modify source code for your needs
✅ **Distribution**: Share modified versions under GPLv3
✅ **Learning & Development**: Study and learn from the codebase

### GPLv3 Requirements

⚠️ **Source Code Disclosure**: Must provide source code to recipients
⚠️ **License Preservation**: All derivatives must remain GPLv3
⚠️ **Copyright Notices**: Maintain original copyright and license notices
⚠️ **Changes Documentation**: Mark modified versions clearly

### GPLv3 Restrictions

❌ **No Branding Changes**: Cannot modify Atlas CMMS branding/trademarks
❌ **No Commercial Distribution**: Cannot resell or offer as SaaS without commercial license
❌ **No White-Labeling**: Cannot rebrand for client deployment
❌ **No Proprietary Forks**: Cannot create closed-source derivatives

## Commercial License

### License File
See [COMMERCIAL_LICENSE.MD](../COMMERCIAL_LICENSE.MD) for full terms.

### When You Need a Commercial License

You **MUST** obtain a commercial license if you plan to:

🏢 **Commercial Distribution**
- Distribute Atlas CMMS to third parties for compensation
- Offer Atlas CMMS as a service (SaaS) to external customers
- Bundle Atlas CMMS with commercial products

🎨 **White-Labeling**
- Remove or modify Atlas CMMS branding
- Apply custom branding for client deployments
- Present the software under your brand identity

🔒 **Proprietary Use**
- Distribute without source code disclosure
- Impose restrictions beyond GPLv3
- Maintain proprietary customizations

### Commercial License Tiers

#### PROFESSIONAL COMMERCIAL LICENSE

**Scope**: Single organization deployment

**Includes**:
- ✅ Full white-labeling rights
- ✅ Up to 100 end-user installations
- ✅ Professional technical support
- ✅ Security updates and bug fixes
- ✅ Commercial releases access

**Use Cases**:
- Mid-sized companies deploying internally
- Service providers managing multiple client sites
- Organizations requiring custom branding

#### ENTERPRISE COMMERCIAL LICENSE

**Scope**: Large-scale commercial deployment

**Includes**:
- ✅ Complete branding and trademark rights
- ✅ Unlimited end-user installations
- ✅ Reseller/sublicensing rights
- ✅ Dedicated custom development services
- ✅ Premium support with guaranteed SLA
- ✅ Early access to beta features

**Use Cases**:
- Large enterprises with multiple facilities
- Software resellers and distributors
- MSPs offering CMMS as a managed service

#### OEM/INTEGRATOR LICENSE

**Scope**: Software vendors and system integrators

**Includes**:
- ✅ Integration/embedding rights
- ✅ Redistribution with commercial products
- ✅ Full source code licensing
- ✅ Flexible royalty structures (per-deployment or revenue-sharing)

**Use Cases**:
- ISVs embedding CMMS functionality
- System integrators building larger solutions
- Technology partners creating integrated offerings

## Licensed Features

### Features Requiring Commercial License

The following advanced features require a valid `LICENSE_KEY`:

🔐 **Single Sign-On (SSO)**
- OAuth2 integration (Google, Microsoft)
- Enterprise authentication systems
- Directory service integration

**Environment Variables**:
```env
LICENSE_KEY=<your-license-key>
ENABLE_SSO=true
OAUTH2_PROVIDER=google|microsoft
OAUTH2_CLIENT_ID=<client-id>
OAUTH2_CLIENT_SECRET=<client-secret>
```

🎨 **White-Labeling & Branding**
- Custom logo replacement
- Color scheme customization
- Brand name and configuration

**Environment Variables**:
```env
LICENSE_KEY=<your-license-key>
LOGO_PATHS={"dark": "dark.png","white": "white.png"}
CUSTOM_COLORS={"primary":"#EE4B2B","secondary":"#6E759F",...}
BRAND_CONFIG={"name": "Your Company", "shortName": "YC", ...}
```

📊 **MUI X Pro Components**
- Advanced data grid features
- Professional date pickers
- Enhanced UI components

**Environment Variables**:
```env
MUI_X_LICENSE=<mui-x-pro-license>
```

## Intellectual Property Rights

### Ownership

**Licensor**: Intelloop LLC
**Copyright**: © 2025 Intelloop LLC. All rights reserved.
**Trademark**: "Atlas CMMS" is a registered trademark of Intelloop LLC

### What You Own
- Your data and content
- Your custom configurations
- Your organization-specific modifications (under license terms)

### What Intelloop LLC Owns
- Atlas CMMS source code and software
- Atlas CMMS trademarks and branding
- All documentation and materials
- Patents and improvements

## Compliance & Enforcement

### License Validation

The backend validates licenses through:
```env
LICENSE_KEY=<your-license-key>
LICENSE_FINGERPRINT_REQUIRED=true
```

### Audit Rights

Commercial license holders agree to:
- Maintain accurate deployment records
- Annual compliance reporting (Enterprise tier)
- Audit cooperation upon reasonable notice

### Violation Consequences

Unauthorized commercial use may result in:
- ⚠️ Immediate license termination
- 💰 Monetary damages
- ⚖️ Legal injunctions
- 💵 Recovery of legal costs and attorney fees

## Obtaining a Commercial License

### Contact Information

**Intelloop LLC**
Atlas CMMS Commercial Licensing Department

📍 **Address**:
410 BD ZERKTOUNI RES. HAMAD APT N°1
CASABLANCA, 20040, MOROCCO

📧 **Email**: contact@atlas-cmms.com
📞 **Phone**: +212 630 690 050
🌐 **Website**: https://atlas-cmms.com

### Licensing Process

1. **Contact Sales**: Email contact@atlas-cmms.com with your requirements
2. **Needs Assessment**: Discuss your use case and deployment scope
3. **License Selection**: Choose appropriate tier (Professional/Enterprise/OEM)
4. **Agreement Execution**: Sign commercial license agreement
5. **License Key Delivery**: Receive license key and activation instructions
6. **Support Onboarding**: Get access to commercial support channels

## Frequently Asked Questions

### Can I modify branding under GPLv3?
**No.** Trademark and branding elements are protected separately from the GPLv3 license. Commercial licensing is required for any branding modifications.

### Can I deploy for clients under GPLv3?
**It depends.** Internal business use is permitted under GPLv3. However:
- ✅ **Allowed**: Deploying for your own organization's multiple locations
- ❌ **Not Allowed**: Deploying for clients as a service provider (requires commercial license)

### What's the difference between licenses?
- **GPLv3**: Free, open source, source code must be shared, no branding changes, no commercial distribution
- **Commercial**: Proprietary distribution allowed, white-labeling permitted, no source code disclosure requirements

### Do I need a license for SaaS?
**Yes.** Offering Atlas CMMS as a service to external customers constitutes commercial use requiring an appropriate commercial license.

### Can I evaluate before purchasing?
**Yes.** Use the GPLv3 version for evaluation. Custom branding and commercial features can be tested after purchasing a license.

### What happens if my license expires?
- Commercial features (SSO, white-labeling) will be disabled
- Core functionality remains available under GPLv3
- Contact licensing to renew for continued commercial features

### Do I need separate licenses for development and production?
**MUI X License**: 1 developer license is perpetual for production
**Atlas CMMS License**: Covers both development and production environments

### Can I transfer my license?
Commercial licenses are non-transferable without written approval from Intelloop LLC. Contact licensing for transfer requests.

## License Compliance Checklist

### For GPLv3 Users
- [ ] Maintain copyright and license notices in source code
- [ ] Provide source code access to all recipients
- [ ] License derivatives under GPLv3
- [ ] Document all modifications clearly
- [ ] Do not modify Atlas CMMS branding

### For Commercial License Holders
- [ ] Install valid LICENSE_KEY in environment
- [ ] Maintain deployment records
- [ ] Comply with tier-specific installation limits
- [ ] Preserve copyright notices in source code
- [ ] Attribute Atlas CMMS appropriately
- [ ] Renew license before expiration
- [ ] Report usage as required by agreement

## Governing Law

**Jurisdiction**: Kingdom of Morocco
**Dispute Resolution**: Courts of Casablanca
**Governing Law**: Laws of Morocco

For legal questions, consult the full license agreements:
- GPLv3: [LICENSE](../LICENSE)
- Commercial: [COMMERCIAL_LICENSE.MD](../COMMERCIAL_LICENSE.MD)
