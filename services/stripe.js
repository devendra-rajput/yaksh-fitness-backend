const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {

    /** Inside stripe.service.js */
    async constructEvent(payload, sig) {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        return stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    }

    /**
     * Create a new Express Connected Account
     * Express is usually best for platforms as Stripe handles the UI & verification
     */
    async createConnectAccount(userEmail) {
        console.log("StripeService@createConnectAccount");
        try {
            const params = {
                type: 'express', // Recommended for most platforms
                email: userEmail,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
            }
            const account = await stripe.accounts.create(params);
            return {
                status: true,
                data: account
            };
        } 
        catch (error) {
            return {
                status: false,
                message: `Stripe Account Creation Failed: ${error.message}`
            }
        }
    }

    /**
     * Generate a link for the user to complete their onboarding
     */
    async createOnboardingLink(stripeAccountId, clientUrl) {
        console.log("StripeService@createOnboardingLink");
        try {
            const params = {
                account: stripeAccountId,
                refresh_url: `${clientUrl}/stripe/reauth`, // URL if link expires
                return_url: `${clientUrl}/stripe/dashboard?onboarding=success`, // URL after completion
                type: 'account_onboarding',
            }
            const accountLink = await stripe.accountLinks.create(params);
            return {
                status: true,
                url: accountLink.url
            };
        } 
        catch (error) {
            return {
                status: false,
                message: `Stripe Onboarding Link Failed: ${error.message}`
            }
        }
    }

    /**
     * Check if the account has finished onboarding
     */
    async getAccountStatus(stripeAccountId) {
        console.log("StripeService@getAccountStatus");

        try {
            if (!stripeAccountId) return false;

            const account = await stripe.accounts.retrieve(stripeAccountId);

            // Map technical keys to readable labels
            const labelMap = {
                'business_profile.mcc': 'Business category',
                'business_profile.url': 'Business website or social media link',
                'business_type': 'Business structure (Individual/Company)',
                'external_account': 'Bank account or debit card for payouts',
                'representative.dob.day': 'Date of birth',
                'representative.email': 'Email address',
                'representative.first_name': 'First name',
                'representative.last_name': 'Last name',
                'settings.payments.statement_descriptor': 'Statement descriptor',
                'individual.verification.document': 'Verification document',
                'tos_acceptance.date': 'Terms of Service acceptance'
            };

            // Extract unique, human-readable messages
            const rawDue = account?.requirements?.currently_due || [];
            const readableRequirements = [...new Set(
                rawDue.map(key => labelMap[key] ? labelMap[key] || key.replace(/_/g, ' ') : null)
            )].filter(item => item);

            return {
                transfer_status: account?.capabilities?.transfers === 'active',
                card_payment_status: account?.capabilities?.card_payments === 'active',
                due_informations: readableRequirements,
                details_submitted: account.details_submitted
            };
        } catch (error) {
            console.error("StripeService Error:", error);
            // If the account ID is invalid or belongs to another platform, Stripe throws an error
            console.log(`Account ${stripeAccountId} is invalid for this Secret Key.`);
            return null;
        }
    }

    /** services/stripe.service.js */
    async validateAccountOwnership(stripeAccountId) {
        try {
            // Attempt to retrieve the account details using your current Secret Key
            const account = await stripe.accounts.retrieve(stripeAccountId);
            
            // If successful, the account exists and is accessible by your keys
            return { 
                isValid: true, 
                account 
            };
        } catch (error) {
            // If error code is 'resource_missing', the ID doesn't exist in this Stripe env
            console.error(`Validation failed for ${stripeAccountId}: ${error.message}`);
            return { 
                isValid: false, 
                error: error.message 
            };
        }
    }

     async getAdminAccountBalance() {
        console.log("PayoutsResource@getAdminAccountBalance");
        try {
            const balance = await stripe.balance.retrieve();
            const availableBalance = balance.available.find(b => b.currency === 'usd');
            const pendingBalance = balance.pending.find(b => b.currency === 'usd');
            return {
                availableBalance,
                pendingBalance,
            };
        } catch (error) {
            console.error('Error retrieving balance:', error);
            // throw error;
            return {
                availableBalance: 0,
                pendingBalance: 0,
            }
        }
    }

    async createPayout (amountToPayout, stripeAccountId) {
        console.log("PayoutsResource@createPayout");
        try {
            let transfer = await stripe.transfers.create(
                {
                    amount: Math.round(amountToPayout * 100), // Convert to cents
                    currency: 'usd',  // Admin's account currency, check this point
                    destination: stripeAccountId,
                    transfer_group: `REFERRAL_PAYOUT_${Date.now()}`, // optional for grouping
                }
            );

            if (!transfer) {
                let message = 'Transfer failed. Unable to complete payout.'
                return { 
                    success: false, 
                    error: message 
                };
            }

            return {
                success: true,
                transfer: transfer
            };
        } catch (err) {
            console.error(err.message);
            return {
                success: false,
                error: err.message
            }
        }
    }
}

module.exports = new StripeService();