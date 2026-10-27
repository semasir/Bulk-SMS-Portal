=== Bulk SMS Portal ===
Contributors: semasir
Tags: sms, bulk sms, sms gateway, sender id, sms api
Requires at least: 6.4
Tested up to: 7.1
Stable tag: 3.9.1
Requires PHP: 8.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Run your own bulk SMS business on WordPress: customer wallets, prices by network and country, sender names, delivery reports and an SMS API.

== Description ==

Bulk SMS Portal turns a WordPress site into a bulk SMS business. Your customers sign up, add money to their wallet, and send SMS from a clean portal on your site. You connect the SMS service you already use, set your prices, and manage everything from one admin area.

= For your customers =

* Send SMS to many numbers at once, with the cost shown before sending.
* Paste numbers separated by commas, semicolons or new lines, or pick a saved group.
* Request a sender name and use it once it is approved.
* See every message with its result: Successful, Sending or Failed, with the reason.
* Add money to the wallet by card with Paystack, or by bank transfer with a payment proof.
* See transactions, prices and a simple dashboard.
* Use an API key to send SMS from their own apps and websites.

= For you, the site owner =

* One price list: set a price per country, per network, or per number prefix. The longest matching prefix sets the price.
* Countries without a price are not sent and not charged.
* Connect NewBulkSMS in one step, or any other SMS service that has a web API (GET, form POST or JSON). One service sends standard, Do Not Disturb and international messages.
* Messages the service accepts count as Successful unless a failure is reported. Failed messages return the money to the customer's wallet.
* Review sender names, payments and customers from one place.
* Reports for messages, payments and wallet changes, with CSV download.
* Branding: your name, colours and support details on every page.
* Optional Google reCAPTCHA on sign-in, sign-up and password reset.

= Bulk SMS Portal Pro (optional) =

Everything described above is free, with no limits on customers, messages or money. For larger businesses there is an optional paid add-on, Bulk SMS Portal Pro, sold separately on our website. It adds:

* Several SMS services, with a different service for standard, Do Not Disturb and international messages, or for a single customer.
* Customer plans, per-customer features, limits and price changes, and reseller accounts.
* Scheduled wallet top-ups and a regular news email to customers who ask for it.
* Flutterwave and WooCommerce checkout, extra currencies and extra portal pages.

This plugin works fully without Pro and never asks you to buy it.

= Pages and shortcodes =

On activation the plugin creates the pages it needs (portal, sign in, sign up, forgot password, buy SMS, help, pricing and payment status). You can also place them yourself:

* `[bsms_portal]` – the customer portal
* `[bsms_login]`, `[bsms_register]`, `[bsms_forgot_password]` – account pages
* `[bsms_public_buy_sms]`, `[bsms_public_pricing]` – public pricing and buying
* `[bsms_help_centre]` – searchable help
* `[bsms_payment_status]` – the page customers return to after paying

== Installation ==

1. In WordPress, go to Plugins > Add New and search for "Bulk SMS Portal", or upload the plugin ZIP file.
2. Activate the plugin. A new "Bulk SMS" menu appears in the admin area.
3. Open Bulk SMS > SMS Services and add the details of your SMS service.
4. Open Bulk SMS > Pricing Manager and enter your prices.
5. Open Bulk SMS > Platform Settings to add your brand name, support email and payment options.
6. Visit the Portal page on your site and send a test message.

== Frequently Asked Questions ==

= Does the plugin send SMS by itself? =

No. You connect your own SMS service (the company that delivers the messages). The plugin sends each message to that service and records the result.

= How are customers charged? =

Money paid into a wallet is credited in full, for example ₦1,000 paid adds ₦1,000. Each message is charged at the price for the number it goes to. Long messages count as more than one SMS, and the cost is always shown before sending.

= What happens to failed messages? =

When the SMS service reports a failure, or the message never reaches the service, the money for that message goes back to the customer's wallet.

= Can customers send to other countries? =

Yes, for any country you have priced, as long as your SMS service delivers there. Numbers in countries without a price are skipped and not charged.

= Is my data removed when I delete the plugin? =

Only if you switch on "Delete all data if the plugin is removed" in Platform Settings. Otherwise your customers, wallets and messages stay in the database so you can reinstall safely.

== External services ==

This plugin connects to the services below only when you set them up and switch them on. Nothing is sent to any of them by default.

= NewBulkSMS =

Used only when you choose "Use NewBulkSMS" under SMS Services and save your NewBulkSMS API key. Each message you or your customers send goes to NewBulkSMS (https://newbulksms.com) with the phone number, the message text, the sender name and your API key. The plugin also asks NewBulkSMS for your account balance and for delivery results. Terms: https://newbulksms.com/terms/ – Privacy: https://newbulksms.com/privacy-policy/

= Your SMS service =

The SMS service you add under SMS Services receives each message you or your customers send: the phone number, the message text and the sender name, along with the account details you enter for that service. The plugin may also ask it for delivery results and your account balance. Which company this is, and its terms and privacy policy, depends on the service you choose.

= Paystack =

Used when you switch on Paystack card payments. When a customer adds money, the plugin sends the amount, the customer's email address, a payment reference, the customer's account number on your site and the addresses to return to after paying to Paystack to start the payment, then asks Paystack to confirm it. Terms: https://paystack.com/terms – Privacy: https://paystack.com/privacy/merchant

= Google reCAPTCHA =

Used when you switch on reCAPTCHA. The sign-in, sign-up, password reset and comment forms load the reCAPTCHA script from google.com, and the plugin sends the check result and the visitor's IP address to Google to confirm the visitor is not a robot. Terms: https://policies.google.com/terms – Privacy: https://policies.google.com/privacy

== Screenshots ==

1. The customer dashboard with wallet balance and recent messages.
2. Sending an SMS, with the cost shown before sending.
3. Messages and their results.
4. The price list for countries, networks and prefixes.

== Changelog ==

= 3.9.1 =
* Fix eight PHP 8.4 implicitly nullable REST request parameter deprecation warnings.


= 3.9.0 =
* Connect NewBulkSMS in one step from SMS Services.
* One SMS service now sends all kinds of messages. Choosing a service per kind of message, or per customer, is part of Bulk SMS Portal Pro.
* Customer plans and exceptions, resellers, scheduled top-ups, the regular news email, Flutterwave, WooCommerce, extra currencies and extra portal pages move to Bulk SMS Portal Pro. Your saved settings and records stay in place.
* Extra sign-in headers for SMS services now work when written as "Name: value" lines.

= 3.8.1 =
* New sign-in, create account, forgot password and new password pages.
* Every word in the plugin can now be translated, including the portal screens.
* Failed messages are always refunded to the customer's wallet, including failures reported after a message first counted as successful.

= 3.8.0 =
* First release on WordPress.org under the name Bulk SMS Portal.
* Security: all printed content is escaped and every database query passes values safely.
* Help search and API copy buttons now load from the plugin's own files.
* Site-specific features for newbulksms.com moved to a separate companion plugin.
* Data from earlier versions (wp-bulk-sms-portal) carries over unchanged.

= 3.7.2 =
* A message the SMS service accepted counts as Successful unless a failure is reported.

= 3.7.1 =
* Page numbers on long lists work everywhere, plus several small fixes.

= 3.7.0 =
* Message IDs in reports, and clearer Delivered and Sent results.

= 3.6.2 =
* One price list for countries, networks and prefixes. Wallets hold money.

== Upgrade Notice ==

= 3.9.0 =
If you use resellers, plans, scheduled top-ups, Flutterwave or several SMS services, install Bulk SMS Portal Pro before updating so they keep working. Nothing is deleted.

= 3.8.1 =
New sign-in pages and full translation support.

= 3.8.0 =
Moving from "WP Bulk SMS Portal"? Deactivate the old plugin first, then activate this one. Your data carries over.
