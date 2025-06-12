# Credit Note System Improvements

## Problem
The previous implementation generated a separate credit note for each cancelled registration, even when multiple registrations were part of the same invoice. This created confusion for parents who expected a single credit note for the entire invoice.

## Solution
We've implemented a consolidated credit note system that creates a single credit note for multiple registrations from the same invoice.

## Key Changes

### Database Schema
1. Modified the `credit_notes` table to make `cancellation_request_id` nullable
   - This allows a credit note to be associated with multiple cancellation requests
   - The credit note is now primarily linked to the invoice rather than individual cancellation requests

### New Edge Function
1. Created a new `create-consolidated-credit-note` Edge Function
   - Handles creating a single credit note for multiple registrations
   - Properly links the credit note to the invoice
   - Creates individual cancellation requests for each registration
   - Updates registration statuses and session counts

### Updated Existing Functions
1. Updated `generate-credit-note-pdf` to handle multiple registrations
   - Shows all cancelled registrations in a single PDF
   - Properly formats the PDF with multiple line items
   - Handles pagination for many registrations

2. Updated `send-credit-note-email` to provide clear information
   - Email now lists all cancelled registrations
   - Provides a clearer subject line and introduction
   - Still attaches the consolidated PDF

3. Updated `process-cancellation-approval` to support consolidated credit notes
   - Checks for related cancellation requests from the same invoice
   - Creates a single credit note when appropriate

### Admin Interface
1. Added a new AdminCreditNotesPage
   - Provides a dedicated interface for managing credit notes
   - Allows creating credit notes for entire invoices
   - Supports partial refunds and custom amounts

2. Updated AdminCancellationRequestsPage
   - Added support for consolidated approval of multiple requests
   - Shows related requests from the same invoice
   - Provides option to process all requests together

## Benefits
1. **Simplified User Experience**: Parents receive a single credit note for all cancelled registrations
2. **Improved Financial Tracking**: Credit notes are properly linked to invoices
3. **Better Admin Control**: Administrators can process multiple cancellations at once
4. **Clearer Communication**: Email and PDF documents clearly show all cancelled items

## Technical Details
- Credit notes are now primarily linked to invoices rather than individual cancellation requests
- Cancellation requests still track individual registrations
- The system maintains backward compatibility with existing credit notes
- PDF generation handles both single and multiple registration scenarios