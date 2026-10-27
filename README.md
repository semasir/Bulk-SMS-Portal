# Bulk SMS Portal

A WordPress plugin for operating an SMS messaging portal with customer accounts, wallets, country/network-based pricing, sender ID requests, delivery reporting and an SMS API.

**Current release:** 3.9.1  
**Requirements:** WordPress 6.4+, PHP 8.0+  
**Licence:** GPL-2.0-or-later

## Features

- Customer SMS composition, contact groups and message history
- Wallet funding and transaction history
- Paystack checkout and manual bank-transfer funding review
- Configurable SMS rates by country, network and prefix
- SMS service configuration, including NewBulkSMS and compatible HTTP APIs
- Sender ID approval, reporting and API-key-based sending
- Optional Google reCAPTCHA

## Installation

1. Download the plugin ZIP from the WordPress.org listing once approved, or package this repository as `bulk-sms-portal/`.
2. In WordPress, open **Plugins → Add New → Upload Plugin**.
3. Activate **Bulk SMS Portal**.
4. Configure the SMS service, rates, payment settings and portal pages in the WordPress admin area.

You will need credentials from an SMS provider to deliver messages. Sending fees and gateway fees are separate from the plugin.

## External services and privacy

The plugin can transmit message details, recipient phone numbers and related requests to the SMS provider selected by the site administrator. Optional payment and anti-spam integrations may transmit data to their respective services. Review the full [WordPress plugin readme](readme.txt) for service disclosures, privacy information and links before deployment.

## Free and Pro

This repository contains the **free core plugin** only. An optional commercial **Bulk SMS Portal Pro** extension is distributed separately. The free plugin works without Pro.

## Development and release history

This repository begins with an import of the existing 3.9.1 release. Its initial GitHub commit date is **not** the start of product development. Earlier versions and development milestones should be supported by original dated archives and records.

See [CHANGELOG.md](CHANGELOG.md) for this imported release.

## Security

Do not commit API keys, payment secrets, customer records, database dumps or WordPress configuration files. For security reports, contact the maintainer privately through the project website rather than opening a public issue with exploit details.

## Links

- [NewBulkSMS](https://newbulksms.com/)
- [WordPress plugin directory](https://wordpress.org/plugins/bulk-sms-portal/) (listing available after approval)

## Licence

GPL-2.0-or-later. See the licence declaration in the main plugin file and `readme.txt`.
