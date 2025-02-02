/**
 * POST /api/contact-form
 */

export function handleJsonRequest(r: Response, num?: number) {
    if (r.ok) return r.json();
    throw new Error(
      `Error (${r.status}) with fetch! #${num??0} - '${r.statusText}' from URL: ${r.url}`
    );
}

export function createDataBodyForUser(templateId: number, toAddress: string) {
    return {
        "to":[  
            {  
               "email": toAddress
            }
        ],
        "templateId": templateId,
        "params":{  
            "email": toAddress
        },
        "headers":{
            "charset":"iso-8859-1"
        }
    };
}

export function createDataBodyForStaff(
    senderName: string,
    senderEmail: string,
    staffAddress: string,
    userAddress: string,
    replyToAddress: string,
    subject: string,
    userMessage: string,
    contact_reason?: string) {

        return {
            sender: { name: senderName, email: senderEmail },
            to:[  {  email: staffAddress } ],
            replyTo: { name: "Staff", email: replyToAddress },
            subject: subject,
            textContent:
                `From: ${userAddress}\n`+
                `${ contact_reason? 'Subject: ' + contact_reason : ''}\n`+
                `Message: ${userMessage}`,
            headers:{  
                charset: 'iso-8859-1'
            }
        };
}

export function simpleDataForStaff(
    staffAddress: string,
    subject: string,
    userAddress: string,
    userMessage: string,
    contact_reason?: string) {

        return createDataBodyForStaff(staffAddress, staffAddress, staffAddress, userAddress, staffAddress, subject, userMessage, contact_reason);
}

export async function onRequestPost({request, env}) {
    let output: any = {};

    try {
        let input = await request.formData();
        // Convert FormData to JSON
        // NOTE: Allows multiple values per key
        for (let [key, value] of input) {
            let tmp = output[key];
            if (tmp === undefined || tmp === "") {
                output[key] = value;
            } else {
                output[key] = [].concat(tmp, value);
            }
        }

        // Make sure all parameters are received.
        if(!('email' in output && 'contact_reason' in output && 'message' in output))
            throw new Error("Does not contain mandatory parameters.");

        console.log("Valid form data received:")
        console.log(output)
    } catch (err) {
        return new Response(`Error parsing JSON content.\n${err}`, { status: 400 });
    }

    try {
        const headerData = {
            method: 'POST',
            headers: {
                "Accept": "application/json",
                "api-key": env.SENDINBLUE_API_KEY,
                "content-type": "application/json"
            }
        },
        HERMES_CONTACT_FORM_TEMPLATE = 9;

        const userData = { 
                ...structuredClone(headerData),
                body: JSON.stringify(createDataBodyForUser(HERMES_CONTACT_FORM_TEMPLATE, output.email))
            },
            staffData = {
                ...structuredClone(headerData),
                body: JSON.stringify(simpleDataForStaff("support@hermesprotocol.io", "Hermes Protocol - Contact Form", output.email, output.message, output.contact_reason))
            };

        /*console.log(`Sending User data:`);
        console.log(userData);
        console.log(`Sending Staff data:`);
        console.log(staffData);*/

        const [ userResult, staffResult,  ] = await Promise.all( 
            [
                fetch("https://api.brevo.com/v3/smtp/email", userData).then((r) => handleJsonRequest(r,1)) as any,
                fetch("https://api.brevo.com/v3/smtp/email", staffData).then((r) => handleJsonRequest(r,2)) as any, 
            ]
        );

        if ("messageId" in userResult && "messageId" in staffResult) {
            return new Response(
                JSON.stringify({ "success": true }),
                {
                    status: 200,
                    statusText: "Emails sent."
                }
            );
        } else {
            return new Response(
                JSON.stringify({ "success": false }),
                {
                    status: 500,
                    statusText: `Something unexpected happened, please try again later.`
                }
            );
          }
    } catch (err) {
        return new Response(
            JSON.stringify({ "success": false }),
            { status: 400, statusText: `Problem contacting SendInBlue...\n${err}` });
    }
}
