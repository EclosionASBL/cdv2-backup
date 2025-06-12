import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

// Define CORS headers with explicit content-type
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json'
};

interface GenerateCreditNoteRequest {
  credit_note_id: string;
  api_key?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests first
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    console.log('Starting generate-credit-note-pdf function');
    
    // Get the authorization header from the incoming request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { 
          status: 401, 
          headers: corsHeaders 
        }
      );
    }

    // Parse request body with error handling
    let requestData: GenerateCreditNoteRequest;
    try {
      requestData = await req.json();
      console.log('Request data:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: corsHeaders 
        }
      );
    }

    const { credit_note_id, api_key } = requestData;

    // Validate required parameters
    if (!credit_note_id) {
      console.error('Missing required parameter: credit_note_id');
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: credit_note_id' }),
        { 
          status: 400, 
          headers: corsHeaders 
        }
      );
    }

    // Initialize environment variables with fallbacks
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const expectedApiKey = Deno.env.get('UPDATE_INVOICE_API_KEY');

    // Validate required environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: corsHeaders 
        }
      );
    }

    // Validate API key if provided and expected
    if (expectedApiKey && api_key && api_key !== expectedApiKey) {
      console.error('Invalid API key');
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { 
          status: 401, 
          headers: corsHeaders 
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching credit note data for:', credit_note_id);
    
    // Get credit note data
    const { data: creditNote, error: creditNoteError } = await supabase
      .from('credit_notes')
      .select(`
        *,
        user:user_id(
          prenom, 
          nom, 
          email, 
          adresse, 
          cpostal, 
          localite, 
          telephone
        ),
        registration:registration_id(
          amount_paid,
          invoice_id,
          kid:kid_id(
            prenom,
            nom
          ),
          session:activity_id(
            stage:stage_id(
              title
            ),
            start_date,
            end_date,
            center:center_id(
              name
            )
          ),
          cancellation_status
        ),
        cancellation_request:cancellation_request_id(
          refund_type
        )
      `)
      .eq('id', credit_note_id)
      .single();

    if (creditNoteError) {
      console.error('Error fetching credit note:', creditNoteError);
      return new Response(
        JSON.stringify({ error: 'Error fetching credit note: ' + creditNoteError.message }),
        { 
          status: 500, 
          headers: corsHeaders 
        }
      );
    }

    if (!creditNote) {
      console.error('Credit note not found:', credit_note_id);
      return new Response(
        JSON.stringify({ error: 'Credit note not found' }),
        { 
          status: 404, 
          headers: corsHeaders 
        }
      );
    }

    // Get invoice details if available
    let invoiceDetails = null;
    if (creditNote.invoice_id || creditNote.invoice_number || 
        (creditNote.registration && creditNote.registration.invoice_id)) {
      
      const invoiceId = creditNote.invoice_number || 
                        creditNote.registration.invoice_id || 
                        creditNote.invoice_id;
      
      try {
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('invoice_number, amount, created_at')
          .eq('invoice_number', invoiceId)
          .maybeSingle();
          
        if (!invoiceError && invoice) {
          invoiceDetails = invoice;
          console.log('Found related invoice:', invoiceDetails);
        }
      } catch (invoiceError) {
        console.error('Error fetching invoice details:', invoiceError);
        // Continue without invoice details
      }
    }

    console.log('Creating PDF document');
    
    // Create PDF document with compression options
    const pdfDoc = await PDFDocument.create();
    
    // Set PDF metadata
    pdfDoc.setTitle(`Note de crédit ${creditNote.credit_note_number}`);
    pdfDoc.setAuthor('Éclosion ASBL');
    pdfDoc.setSubject('Note de crédit pour annulation de stage');
    pdfDoc.setKeywords(['note de crédit', 'stage', 'enfant', 'éclosion']);
    pdfDoc.setCreator('Éclosion ASBL - Système de facturation');
    
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const { width, height } = page.getSize();
    
    // Get fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Set some constants
    const margin = 50;
    const lineHeight = 15;
    let currentY = height - margin;
    
    // Add header
    page.drawText('NOTE DE CRÉDIT', {
      x: margin,
      y: currentY,
      size: 24,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    
    // Add credit note number and date
    currentY -= 40;
    page.drawText(`Note de crédit N° ${creditNote.credit_note_number}`, {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
    currentY -= lineHeight;
    page.drawText(`Date: ${new Date(creditNote.created_at).toLocaleDateString('fr-BE')}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    // Add invoice reference if available
    if (invoiceDetails || creditNote.invoice_number) {
      currentY -= lineHeight;
      page.drawText(`Référence facture: ${creditNote.invoice_number || invoiceDetails?.invoice_number || creditNote.registration.invoice_id}`, {
        x: margin,
        y: currentY,
        size: 10,
        font: helveticaFont,
      });
      
      if (invoiceDetails) {
        currentY -= lineHeight;
        page.drawText(`Date facture: ${new Date(invoiceDetails.created_at).toLocaleDateString('fr-BE')}`, {
          x: margin,
          y: currentY,
          size: 10,
          font: helveticaFont,
        });
      }
    }
    
    // Add company info
    currentY -= 40;
    page.drawText('Éclosion ASBL', {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
    currentY -= lineHeight;
    page.drawText('125 Rue Josse Impens', {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText('1030 Schaerbeek', {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    // Add client info
    currentY -= 40;
    page.drawText('Client:', {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
    const user = Array.isArray(creditNote.user) ? creditNote.user[0] : creditNote.user;
    
    currentY -= lineHeight;
    page.drawText(`${user.prenom} ${user.nom}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`${user.adresse}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`${user.cpostal} ${user.localite}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`Email: ${user.email}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`Téléphone: ${user.telephone || 'Non renseigné'}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    // Add table header
    currentY -= 40;
    const col1 = margin;
    const col2 = margin + 200;
    const col3 = margin + 300;
    const col4 = margin + 400;
    
    page.drawText('Description', {
      x: col1,
      y: currentY,
      size: 10,
      font: helveticaBold,
    });
    
    page.drawText('Enfant', {
      x: col2,
      y: currentY,
      size: 10,
      font: helveticaBold,
    });
    
    page.drawText('Type', {
      x: col3,
      y: currentY,
      size: 10,
      font: helveticaBold,
    });
    
    page.drawText('Montant', {
      x: col4,
      y: currentY,
      size: 10,
      font: helveticaBold,
    });
    
    // Draw table header line
    currentY -= 5;
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: width - margin, y: currentY },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    // Add table row
    currentY -= 15;
    
    const registration = Array.isArray(creditNote.registration) ? creditNote.registration[0] : creditNote.registration;
    const kid = Array.isArray(registration.kid) ? registration.kid[0] : registration.kid;
    const session = Array.isArray(registration.session) ? registration.session[0] : registration.session;
    const stage = Array.isArray(session.stage) ? session.stage[0] : session.stage;
    const center = Array.isArray(session.center) ? session.center[0] : session.center;
    
    const startDate = new Date(session.start_date).toLocaleDateString('fr-BE');
    const endDate = new Date(session.end_date).toLocaleDateString('fr-BE');
    
    // Determine if this is a full cancellation or a price adjustment
    const cancellationRequest = Array.isArray(creditNote.cancellation_request) 
      ? creditNote.cancellation_request[0] 
      : creditNote.cancellation_request;
    
    const isFullCancellation = cancellationRequest.refund_type === 'full' || 
                              registration.cancellation_status === 'cancelled_full_refund';
    
    const description = isFullCancellation
      ? `Annulation stage: ${stage.title}`
      : `Ajustement de prix: ${stage.title}`;
    
    page.drawText(description, {
      x: col1,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    page.drawText(`${kid.prenom} ${kid.nom}`, {
      x: col2,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    let refundTypeText = isFullCancellation ? 'Remboursement complet' : 'Remboursement partiel';
    
    page.drawText(refundTypeText, {
      x: col3,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    page.drawText(`${creditNote.amount} €`, {
      x: col4,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= 10;
    page.drawText(`${startDate} au ${endDate}`, {
      x: col1 + 10,
      y: currentY,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    page.drawText(`Centre: ${center.name}`, {
      x: col2,
      y: currentY,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    currentY -= 15;
    
    // Draw table footer line
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: width - margin, y: currentY },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    
    // Add total
    currentY -= 20;
    page.drawText('Total:', {
      x: col3,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
    page.drawText(`${creditNote.amount} €`, {
      x: col4,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
    // Add invoice reference section
    if (invoiceDetails || creditNote.invoice_number) {
      currentY -= 40;
      page.drawText('Référence facture:', {
        x: margin,
        y: currentY,
        size: 12,
        font: helveticaBold,
      });
      
      currentY -= lineHeight;
      page.drawText(`Numéro de facture: ${creditNote.invoice_number || invoiceDetails?.invoice_number || creditNote.registration.invoice_id}`, {
        x: margin,
        y: currentY,
        size: 10,
        font: helveticaFont,
      });
      
      if (invoiceDetails) {
        currentY -= lineHeight;
        page.drawText(`Montant initial: ${invoiceDetails.amount} €`, {
          x: margin,
          y: currentY,
          size: 10,
          font: helveticaFont,
        });
        
        currentY -= lineHeight;
        page.drawText(`Montant après note de crédit: ${Math.max(0, invoiceDetails.amount - creditNote.amount)} €`, {
          x: margin,
          y: currentY,
          size: 10,
          font: helveticaFont,
        });
      }
    }
    
    // Add note
    currentY -= 40;
    page.drawText('Note:', {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
    currentY -= lineHeight;
    
    // Customize the note text based on whether it's a full cancellation or price adjustment
    const noteText = isFullCancellation
      ? 'Cette note de crédit est émise suite à l\'annulation d\'une inscription.'
      : 'Cette note de crédit est émise suite à un ajustement de prix.';
    
    page.drawText(noteText, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight * 2;
    page.drawText('Le montant sera remboursé par virement bancaire dans les 30 jours.', {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    // Add footer
    currentY = margin + 30;
    page.drawText('Éclosion ASBL - 125 Rue Josse Impens, 1030 Schaerbeek', {
      x: width / 2 - 180,
      y: currentY,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    currentY -= lineHeight;
    page.drawText('Téléphone: +32 470 470 503 - Email: info@eclosion.be', {
      x: width / 2 - 150,
      y: currentY,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    console.log('PDF document created, serializing to bytes');
    
    // Serialize the PDF to bytes with compression
    const pdfBytes = await pdfDoc.save({
      addDefaultPage: false,
      useObjectStreams: true
    });
    
    console.log('Uploading PDF to Supabase Storage');
    
    const fileName = `${creditNote.credit_note_number}.pdf`;
    
    // Check available buckets
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log('Available buckets:', buckets?.map(b => b.name).join(', '));
    
    // Try different buckets in order of preference
    const bucketsToTry = ['credit-notes', 'public', 'storage'];
    let uploadError = null;
    let pdfUrl = null;
    
    for (const bucketName of bucketsToTry) {
      if (buckets?.some(b => b.name === bucketName)) {
        console.log(`Attempting to upload to '${bucketName}' bucket`);
        
        try {
          const { error: uploadErr } = await supabase.storage
            .from(bucketName)
            .upload(`credit-notes/${fileName}`, pdfBytes, {
              contentType: 'application/pdf',
              upsert: true
            });
            
          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(`credit-notes/${fileName}`);
              
            pdfUrl = publicUrlData.publicUrl;
            console.log('PDF uploaded successfully to bucket:', bucketName);
            console.log('PDF public URL:', pdfUrl);
            break;
          } else {
            console.error(`Error uploading to '${bucketName}' bucket:`, uploadErr);
            uploadError = uploadErr;
          }
        } catch (err) {
          console.error(`Error trying to upload to '${bucketName}' bucket:`, err);
          uploadError = err;
        }
      }
    }
    
    if (!pdfUrl) {
      console.error('Failed to upload PDF to any bucket');
      return new Response(
        JSON.stringify({ 
          error: 'Failed to upload PDF: ' + (uploadError?.message || 'No suitable storage bucket found') 
        }),
        { 
          status: 500, 
          headers: corsHeaders 
        }
      );
    }
    
    // Update credit note with PDF URL
    const { error: updateError } = await supabase
      .from('credit_notes')
      .update({ pdf_url: pdfUrl })
      .eq('id', credit_note_id);
      
    if (updateError) {
      console.error('Error updating credit note with PDF URL:', updateError);
    } else {
      console.log('Credit note updated with PDF URL');
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf_url: pdfUrl 
      }),
      {
        status: 200,
        headers: corsHeaders
      }
    );
  } catch (error) {
    console.error('Error generating credit note PDF:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
});