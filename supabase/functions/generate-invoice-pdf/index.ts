import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface GenerateInvoiceRequest {
  invoice_number: string;
  api_key: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Starting generate-invoice-pdf function');
    
    // Get the authorization header from the incoming request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    let requestData;
    try {
      requestData = await req.json() as GenerateInvoiceRequest;
      console.log('Request data:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { invoice_number, api_key } = requestData;

    // Validate required parameters
    if (!invoice_number) {
      console.error('Missing required parameter: invoice_number');
      return new Response(
        JSON.stringify({ error: "Missing required parameter: invoice_number" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate API key if provided
    const expectedApiKey = Deno.env.get("UPDATE_INVOICE_API_KEY");
    if (api_key && expectedApiKey && api_key !== expectedApiKey) {
      console.error('Invalid API key');
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching invoice data for:', invoice_number);
    
    // Get invoice data - FIXED: Use separate queries instead of a join that's causing issues
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('invoice_number', invoice_number)
      .single();

    if (invoiceError) {
      console.error("Error fetching invoice:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Error fetching invoice: " + invoiceError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!invoice) {
      console.error("Invoice not found:", invoice_number);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user data separately
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('prenom, nom, email, adresse, cpostal, localite, telephone')
      .eq('id', invoice.user_id)
      .single();

    if (userError) {
      console.error("Error fetching user:", userError);
      return new Response(
        JSON.stringify({ error: "Error fetching user: " + userError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Fetching registrations for invoice:', invoice_number);
    
    // Get registrations data
    const { data: registrations, error: registrationsError } = await supabase
      .from('registrations')
      .select(`
        id,
        amount_paid,
        price_type,
        kid:kids(
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
        )
      `)
      .in('id', invoice.registration_ids);

    if (registrationsError) {
      console.error("Error fetching registrations:", registrationsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch registration details: " + registrationsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Creating PDF document');
    
    // Create PDF document with compression options
    const pdfDoc = await PDFDocument.create();
    
    // Set PDF metadata to optimize file size
    pdfDoc.setTitle(`Facture ${invoice.invoice_number}`);
    pdfDoc.setAuthor('Éclosion ASBL');
    pdfDoc.setSubject('Facture pour inscription aux stages');
    pdfDoc.setKeywords(['facture', 'stage', 'enfant', 'éclosion']);
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
    page.drawText('FACTURE', {
      x: margin,
      y: currentY,
      size: 24,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    
    // Add invoice number and date
    currentY -= 40;
    page.drawText(`Facture N° ${invoice.invoice_number}`, {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
    currentY -= lineHeight;
    page.drawText(`Date: ${new Date(invoice.created_at).toLocaleDateString('fr-BE')}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`Échéance: ${new Date(invoice.due_date).toLocaleDateString('fr-BE')}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
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
    page.drawText('Facturé à:', {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
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
    const tableTop = currentY;
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
    
    page.drawText('Tarif', {
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
    
    // Add table rows
    currentY -= 15;
    
    for (const reg of registrations || []) {
      // Unwrap nested objects if they're arrays (handling potential Supabase quirk)
      const kidData = Array.isArray(reg.kid) ? reg.kid[0] : reg.kid;
      const sessionData = Array.isArray(reg.session) ? reg.session[0] : reg.session;
      const stageData = Array.isArray(sessionData.stage) ? sessionData.stage[0] : sessionData.stage;
      const centerData = Array.isArray(sessionData.center) ? sessionData.center[0] : sessionData.center;
      
      const startDate = new Date(sessionData.start_date).toLocaleDateString('fr-BE');
      const endDate = new Date(sessionData.end_date).toLocaleDateString('fr-BE');
      
      page.drawText(`${stageData.title}`, {
        x: col1,
        y: currentY,
        size: 10,
        font: helveticaFont,
      });
      
      page.drawText(`${kidData.prenom} ${kidData.nom}`, {
        x: col2,
        y: currentY,
        size: 10,
        font: helveticaFont,
      });
      
      let tarifText = 'Standard';
      if (reg.price_type.includes('reduced')) {
        tarifText = 'Réduit';
      } else if (reg.price_type.includes('local')) {
        tarifText = 'Local';
      }
      
      page.drawText(tarifText, {
        x: col3,
        y: currentY,
        size: 10,
        font: helveticaFont,
      });
      
      page.drawText(`${reg.amount_paid} €`, {
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
      
      page.drawText(`Centre: ${centerData.name}`, {
        x: col2,
        y: currentY,
        size: 8,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      });
      
      currentY -= 15;
    }
    
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
    
    page.drawText(`${invoice.amount} €`, {
      x: col4,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
    // Add payment instructions
    currentY -= 40;
    page.drawText('Instructions de paiement:', {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
    });
    
    currentY -= lineHeight;
    page.drawText('Veuillez effectuer le paiement par virement bancaire aux coordonnées suivantes:', {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight * 2;
    page.drawText('IBAN: BE64 3631 1005 7452', {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText('BIC: BBRUBEBB', {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText('Bénéficiaire: Éclosion ASBL', {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`Communication: ${invoice.communication}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaBold,
    });
    
    currentY -= lineHeight * 2;
    page.drawText(`Veuillez effectuer le paiement avant le ${new Date(invoice.due_date).toLocaleDateString('fr-BE')}.`, {
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
    
    // Serialize the PDF to bytes with compression options
    const pdfBytes = await pdfDoc.save({
      // Utiliser la compression pour réduire la taille du PDF
      addDefaultPage: false,
      useObjectStreams: true
    });
    
    console.log('Uploading PDF to Supabase Storage');
    
    // Upload PDF to Supabase Storage - FIXED: Use 'invoices' bucket instead of 'public'
    const fileName = `${invoice_number}.pdf`;
    
    // Check if the bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log('Available buckets:', buckets?.map(b => b.name).join(', '));
    
    // Try to upload to the 'invoices' bucket first, if it exists
    let uploadError = null;
    let pdfUrl = null;
    
    // Try different buckets in order of preference
    const bucketsToTry = ['invoices', 'public', 'storage'];
    
    for (const bucketName of bucketsToTry) {
      if (buckets?.some(b => b.name === bucketName)) {
        console.log(`Attempting to upload to '${bucketName}' bucket`);
        
        try {
          const { error: uploadErr } = await supabase.storage
            .from(bucketName)
            .upload(`invoices/${fileName}`, pdfBytes, {
              contentType: 'application/pdf',
              upsert: true
            });
            
          if (!uploadErr) {
            // Get public URL
            const { data: publicUrlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(`invoices/${fileName}`);
              
            pdfUrl = publicUrlData.publicUrl;
            console.log('PDF uploaded successfully to bucket:', bucketName);
            console.log('PDF public URL:', pdfUrl);
            break; // Exit the loop if upload is successful
          } else {
            console.error(`Error uploading to '${bucketName}' bucket:`, uploadErr);
            uploadError = uploadErr;
          }
        } catch (err) {
          console.error(`Error trying to upload to '${bucketName}' bucket:`, err);
          uploadError = err;
        }
      } else {
        console.log(`Bucket '${bucketName}' does not exist, skipping`);
      }
    }
    
    if (!pdfUrl) {
      console.error("Failed to upload PDF to any bucket");
      return new Response(
        JSON.stringify({ error: "Failed to upload PDF: " + (uploadError?.message || "No suitable storage bucket found") }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Update invoice with PDF URL
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ pdf_url: pdfUrl })
      .eq('invoice_number', invoice_number);
      
    if (updateError) {
      console.error("Error updating invoice with PDF URL:", updateError);
      // Continue anyway, as we can still return the PDF URL
    } else {
      console.log('Invoice updated with PDF URL');
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf_url: pdfUrl 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});