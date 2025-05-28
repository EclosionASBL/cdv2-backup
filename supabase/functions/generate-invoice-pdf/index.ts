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
    if (!invoice_number || !api_key) {
      console.error('Missing required parameters:', { hasInvoiceNumber: !!invoice_number, hasApiKey: !!api_key });
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate API key
    const expectedApiKey = Deno.env.get("UPDATE_INVOICE_API_KEY");
    if (!expectedApiKey || api_key !== expectedApiKey) {
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
    
    // Get invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
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
        )
      `)
      .eq('invoice_number', invoice_number)
      .single();

    if (invoiceError || !invoice) {
      console.error("Error fetching invoice:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
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
        )
      `)
      .in('id', invoice.registration_ids);

    if (registrationsError) {
      console.error("Error fetching registrations:", registrationsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch registration details" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Creating PDF document');
    
    // Create PDF document
    const pdfDoc = await PDFDocument.create();
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
    
    currentY -= lineHeight;
    page.drawText('TVA: BE0123456789', {
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
    page.drawText(`${invoice.user.prenom} ${invoice.user.nom}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`${invoice.user.adresse}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`${invoice.user.cpostal} ${invoice.user.localite}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`Email: ${invoice.user.email}`, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
    });
    
    currentY -= lineHeight;
    page.drawText(`Téléphone: ${invoice.user.telephone || 'Non renseigné'}`, {
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
      const startDate = new Date(reg.session.start_date).toLocaleDateString('fr-BE');
      const endDate = new Date(reg.session.end_date).toLocaleDateString('fr-BE');
      
      page.drawText(`${reg.session.stage.title}`, {
        x: col1,
        y: currentY,
        size: 10,
        font: helveticaFont,
      });
      
      page.drawText(`${reg.kid.prenom} ${reg.kid.nom}`, {
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
      
      page.drawText(`Centre: ${reg.session.center.name}`, {
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
    page.drawText('IBAN: BE12 3456 7890 1234', {
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
    page.drawText('Éclosion ASBL - 125 Rue Josse Impens, 1030 Schaerbeek - TVA: BE0123456789', {
      x: width / 2 - 200,
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
    
    // Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();
    
    console.log('Uploading PDF to Supabase Storage');
    
    // Upload PDF to Supabase Storage
    const fileName = `invoices/${invoice_number}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('public')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });
      
    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload PDF" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log('PDF uploaded successfully, getting public URL');
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('public')
      .getPublicUrl(fileName);
      
    const pdfUrl = publicUrlData.publicUrl;
    console.log('PDF public URL:', pdfUrl);
    
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