# AWS SES Email Notification Setup Guide

This guide will help you set up AWS SES (Simple Email Service) for sending email notifications when sensor thresholds are exceeded. AWS SES provides high deliverability and low spam risk.

## Prerequisites

1. An AWS account (create one at https://aws.amazon.com/)
2. Access to AWS Console
3. Your domain email address (or verified email for testing)

## Step 1: Access AWS SES Console

1. Log in to your AWS account
2. Navigate to **Amazon SES** service
3. Select your preferred region (e.g., `us-east-1`, `us-west-2`, `eu-west-1`)

## Step 2: Verify Email Address (Sandbox Mode)

When you first use SES, you're in **sandbox mode** which only allows sending to verified email addresses.

1. In SES Console, go to **Verified identities**
2. Click **Create identity**
3. Select **Email address**
4. Enter your email address (e.g., `alerts@yourdomain.com`)
5. Click **Create identity**
6. Check your email inbox and click the verification link
7. Your email is now verified

**Note:** In sandbox mode, you can only send emails TO verified addresses. You can verify multiple addresses for testing.

## Step 3: Request Production Access (Recommended)

To send emails to any address (not just verified ones), request production access:

1. In SES Console, go to **Account dashboard**
2. Click **Request production access**
3. Fill out the form:
   - **Mail Type:** Transactional
   - **Website URL:** Your greenhouse dashboard URL
   - **Use case description:** "Greenhouse monitoring system sending threshold alert emails to registered users"
   - **Expected sending volume:** Estimate your monthly emails
   - **How do you plan to build or maintain your email list?** "Users register through our application"
4. Submit the request
5. Usually approved within 24 hours

## Step 4: Create IAM User for SES

Create an IAM user with permissions to send emails via SES:

1. Go to **IAM Console** → **Users** → **Create user**
2. User name: `ses-email-sender`
3. Select **Provide user access to the AWS Management Console** (optional, for testing)
4. Click **Next**
5. Under **Set permissions**, select **Attach policies directly**
6. Search for and select **AmazonSESFullAccess** (or create a custom policy with only `ses:SendEmail` permission)
7. Click **Next** → **Create user**
8. Click on the user → **Security credentials** tab
9. Click **Create access key**
10. Select **Application running outside AWS**
11. Click **Create access key**
12. **IMPORTANT:** Save both:
    - **Access key ID**
    - **Secret access key** (only shown once!)

## Step 5: Verify Domain (Optional but Recommended)

For better deliverability and to send from your domain:

1. In SES Console → **Verified identities** → **Create identity**
2. Select **Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Click **Create identity**
5. AWS will provide DNS records to add:
   - **SPF record** (for email authentication)
   - **DKIM records** (for email signing)
   - **DMARC record** (optional, for email policy)
6. Add these records to your domain's DNS settings
7. Wait for verification (usually 24-48 hours)

## Step 6: Configure Environment Variables

Add the following to your `.env` file in the `server` directory:

```env
# AWS SES Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here
SES_FROM_EMAIL=alerts@yourdomain.com
DASHBOARD_URL=https://yourdomain.com
```

**Important Notes:**
- Replace `your-access-key-id-here` with your actual Access Key ID
- Replace `your-secret-access-key-here` with your actual Secret Access Key
- Replace `alerts@yourdomain.com` with your verified email address
- Replace `https://yourdomain.com` with your actual dashboard URL
- The `SES_FROM_EMAIL` must be a verified email address in SES

## Step 7: Install Dependencies

In your `server` directory, run:

```bash
npm install
```

This will install the `aws-sdk` package required for SES.

## Step 8: Test Email Notifications

1. Start your server:
   ```bash
   node server.js
   ```

2. You should see:
   ```
   ✅ AWS SES initialized
      Region: us-east-1
      From Email: alerts@yourdomain.com
   ```

3. If you see warnings, check your `.env` file configuration

4. Trigger a threshold alert in your dashboard to test email sending

## Troubleshooting

### Error: "Email address is not verified"

**Solution:** You're in sandbox mode. Either:
- Verify the recipient email address in SES Console, OR
- Request production access

### Error: "MessageRejected"

**Solution:** 
- Check that the `SES_FROM_EMAIL` is verified in SES
- Check that you're not in sandbox mode (or recipient is verified)
- Check your IAM user has `ses:SendEmail` permission

### Error: "Throttling"

**Solution:** 
- You're sending too many emails too quickly
- SES has rate limits (check your SES Console → Sending statistics)
- Wait a few minutes and try again

### Emails going to spam

**Solution:**
- Verify your domain (Step 5) and add SPF/DKIM records
- Use a proper "From" address (not a free email like Gmail)
- Ensure email content follows best practices (already implemented)
- Check your domain's reputation

## AWS SES Pricing

- **Free Tier:** 62,000 emails/month (if sending from EC2 in same region)
- **After Free Tier:** $0.10 per 1,000 emails
- **Very cost-effective** for monitoring alerts

## Security Best Practices

1. **Never commit `.env` file** to version control
2. **Use IAM roles** instead of access keys when running on EC2
3. **Rotate access keys** regularly
4. **Use least privilege** - only grant `ses:SendEmail` permission
5. **Monitor SES usage** in AWS Console

## Testing in Development

For development/testing, you can use SES sandbox mode with verified email addresses. This is free and perfect for testing.

## Production Checklist

- [ ] Production access requested and approved
- [ ] Domain verified (if using custom domain)
- [ ] SPF/DKIM records added to DNS
- [ ] IAM user created with minimal permissions
- [ ] Environment variables configured
- [ ] Email notifications tested
- [ ] Monitoring set up in AWS Console

## Support

For AWS SES issues:
- AWS SES Documentation: https://docs.aws.amazon.com/ses/
- AWS Support: https://aws.amazon.com/support/

For application issues:
- Check server logs for error messages
- Verify environment variables are set correctly
- Ensure email notifications are enabled in dashboard settings



