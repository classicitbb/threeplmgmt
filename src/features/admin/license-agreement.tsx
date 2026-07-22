import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

type LicenseBlock =
  | { type: "h1"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "li"; text: string }
  | { type: "and" }
  | { type: "note"; text: string }
  | { type: "party"; label: string; name: string };

const LICENSE_BLOCKS: LicenseBlock[] = [
  { type: "h1", text: "SOFTWARE LICENSE AND SUPPORT AGREEMENT" },
  { type: "subtitle", text: "Warehouse Wizard™ Warehouse Management System" },
  { type: "p", text: "This Software License and Support Agreement (the “Agreement”) governs Licensee's access to and use of the Software as of the Effective Date specified in the applicable Order Form, by and between:" },
  { type: "p", text: "Classic Visions, a service-provider partnership with a principal place of business at Uplands, St John, Barbados (“Licensor”), the developer and owner of the Warehouse Wizard software;" },
  { type: "and" },
  { type: "p", text: "The customer entity identified in the applicable Order Form, together with its principal place of business as stated there (“Licensee”)." },
  { type: "p", text: "Licensor and Licensee are each a “Party” and together the “Parties.”" },

  { type: "h2", text: "1. Definitions" },
  { type: "p", text: "“Software” means the Warehouse Wizard warehouse management system, including its web application, associated mobile/PWA client, label and printing modules, and all related object code, configuration, and documentation provided by Licensor, together with any Updates provided under this Agreement." },
  { type: "p", text: "“Documentation” means Licensor's user guides, admin/go-live guides, API references, and other written materials describing the use of the Software." },
  { type: "p", text: "“Licensed Site(s)” means the specific warehouse facility or facilities identified in the Order Form at which Licensee is authorized to operate the Software." },
  { type: "p", text: "“Updates” means bug fixes, patches, and minor version updates to the Software that Licensor generally makes available to its licensees, excluding new standalone products or major re-architected releases that Licensor separately markets and prices (“Upgrades”)." },
  { type: "p", text: "“Support Term” means the period during which Licensee is entitled to receive Support Services under Section 5, as specified in the Order Form." },
  { type: "p", text: "“Authorized Users” means Licensee's employees and contractors who are authorized to access the Software for Licensee's internal business operations." },

  { type: "h2", text: "2. License Grant" },
  { type: "p", text: "2.1 Grant. Subject to Licensee's payment of the License Fee and continuing compliance with this Agreement, Licensor grants Licensee a perpetual (subject to Section 8), non-exclusive, non-transferable, non-sublicensable license to install, access, and use the Software and Documentation solely at the Licensed Site(s), solely for Licensee's own internal 3PL/warehouse operations, and solely by Authorized Users." },
  { type: "p", text: "2.2 Scope and Metering. The license is scoped to the number of Licensed Sites and Authorized User seats identified in the Order Form. Use beyond that scope (additional warehouses, entities, or seats) requires a separate written order and additional fees." },
  { type: "p", text: "2.3 Reservation of Rights. Licensor retains all right, title, and interest in and to the Software, Documentation, and all associated intellectual property, including all Updates and Upgrades. No rights are granted to Licensee except as expressly stated in this Agreement. This is a license to use the Software, not a sale of the Software or any copy of it." },
  { type: "p", text: "2.4 Third-Party Components. The Software may incorporate open-source or third-party components that remain subject to their own license terms; Licensor will identify material components on request." },

  { type: "h2", text: "3. Restrictions" },
  { type: "p", text: "Licensee shall not, and shall not permit any third party to:" },
  { type: "li", text: "copy, modify, translate, or create derivative works of the Software, except as necessary for ordinary configuration through features Licensor makes available for that purpose;" },
  { type: "li", text: "reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Software, except to the extent such restriction is prohibited by applicable law;" },
  { type: "li", text: "sublicense, rent, lease, sell, distribute, host as a service to third parties, or otherwise make the Software available to any person or entity other than Authorized Users;" },
  { type: "li", text: "remove, obscure, or alter any proprietary notices, labels, or marks on or in the Software or Documentation;" },
  { type: "li", text: "use the Software at any facility other than a Licensed Site, or on behalf of any entity other than Licensee, without Licensor's prior written consent;" },
  { type: "li", text: "use the Software to build or support a product that competes with the Software." },

  { type: "h2", text: "4. Fees and Payment" },
  { type: "p", text: "4.1 License Fee. In consideration of the license granted in Section 2, Licensee shall pay Licensor the one-time license fee set forth in the Order Form (the “License Fee”). Unless otherwise stated in the Order Form, the License Fee is due upon execution of this Agreement and is a condition of the license taking effect." },
  { type: "p", text: "4.2 Support Fee. Ongoing Support Services under Section 5 are provided for the Support Fee set forth in the Order Form, billed on the schedule stated there (e.g., annually or monthly). Support Services are optional after the first Support Term; Licensee's right to use the Software under Section 2 continues whether or not Support Services are renewed, but Updates, upgrade pricing, and support response times described in Section 5 apply only during an active, paid Support Term." },
  { type: "p", text: "4.3 Taxes. Fees are exclusive of applicable sales, use, VAT, or similar taxes, which Licensee is responsible for except taxes on Licensor's net income." },
  { type: "p", text: "4.4 Late Payment. Amounts not paid when due accrue interest at 1.5% per month (or the maximum rate permitted by law, if lower) and Licensor may suspend Support Services and, after 30 days' written notice, access to the Software until past-due amounts are paid." },
  { type: "p", text: "4.5 No Refunds. Except as expressly provided in Section 9 (Warranty) or required by law, all fees are non-refundable once paid." },

  { type: "h2", text: "5. Support Services" },
  { type: "p", text: "5.1 Scope. During an active Support Term, Licensor will provide: (a) telephone/email/ticket support for reproducible defects in the Software during Licensor's normal business hours; (b) Updates as Licensor makes them generally available; and (c) reasonable assistance with configuration questions related to normal use of the Software. Support does not include on-site services, custom development, data migration, integration work, or training, which may be quoted separately." },
  { type: "p", text: "5.2 Response Targets. Licensor will use commercially reasonable efforts to respond to support requests within the timeframes stated below, based on the severity Licensor reasonably assigns to the issue. Response targets are goals, not guarantees, and are not subject to service-credit remedies unless separately agreed in writing." },
  {
    type: "li",
    text: "Critical (system down / data-integrity issue): initial response within 2 business hours.",
  },
  { type: "li", text: "High (major feature unusable, no workaround): initial response within 1 business day." },
  { type: "li", text: "Normal (minor defect, workaround available): initial response within 3 business days." },
  { type: "li", text: "Low (cosmetic / enhancement request): initial response within 5 business days." },
  { type: "p", text: "5.3 Upgrades. Upgrades (as distinguished from Updates in Section 1) are offered at Licensor's then-current pricing and are not included in the Support Fee unless the Order Form states otherwise." },
  { type: "p", text: "5.4 Client Responsibilities. Licensee is responsible for maintaining its own hosting/database environment (including any Supabase or equivalent backend project), internet connectivity, hardware, and for maintaining current backups of its own data, except to the extent Licensor has separately agreed in writing to provide hosting or backup services." },

  { type: "h2", text: "6. Data and Confidentiality" },
  { type: "p", text: "6.1 Licensee Data. As between the Parties, Licensee owns all data it inputs into or generates through the Software (“Licensee Data”). Licensor will not access Licensee Data except as reasonably necessary to provide Support Services or as Licensee otherwise directs." },
  { type: "p", text: "6.2 Confidentiality. Each Party will protect the other's non-public information disclosed in connection with this Agreement with at least the same degree of care it uses for its own confidential information of similar nature, and will use it only to perform this Agreement. This obligation does not apply to information that is public, independently developed, rightfully received from a third party without duty of confidentiality, or required to be disclosed by law (with prior notice to the disclosing Party where legally permitted)." },
  { type: "p", text: "6.3 Software Confidentiality. The Software's non-public source code, architecture, and Documentation are Licensor's confidential information and trade secrets, and Licensee will protect them accordingly, in addition to the restrictions in Section 3." },

  { type: "h2", text: "7. Warranty and Disclaimer" },
  { type: "p", text: "7.1 Limited Warranty. Licensor warrants that, for 90 days following delivery, the Software will materially conform to its then-current Documentation when used as intended on a Licensed Site. Licensee's sole and exclusive remedy for breach of this warranty is that Licensor will use commercially reasonable efforts to correct the non-conformity or, if it cannot do so within a reasonable time, refund the License Fee in exchange for termination of the license." },
  { type: "p", text: "7.2 Disclaimer. EXCEPT AS EXPRESSLY STATED IN SECTION 7.1, THE SOFTWARE AND DOCUMENTATION ARE PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT, AND LICENSOR DOES NOT WARRANT THAT THE SOFTWARE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF SECURITY VULNERABILITIES." },

  { type: "h2", text: "8. Term and Termination" },
  { type: "p", text: "8.1 Term. This Agreement begins on the Effective Date and continues until terminated as provided below. The license granted in Section 2 is perpetual once the License Fee is paid in full, subject to earlier termination under this Section 8." },
  { type: "p", text: "8.2 Termination for Cause. Either Party may terminate this Agreement on written notice if the other Party materially breaches this Agreement and fails to cure the breach within 30 days after receiving written notice describing the breach." },
  { type: "p", text: "8.3 Termination for Non-Payment. Licensor may terminate the license under Section 2 if Licensee fails to pay any undisputed amount within 30 days after the notice described in Section 4.4." },
  { type: "p", text: "8.4 Effect of Termination. Upon termination of the license, Licensee must cease all use of the Software and, on request, certify in writing that it has uninstalled the Software and deleted all copies in its possession, except that Licensee may retain Licensee Data exported before termination. Sections 3, 6, 7.2, 9, 10, and 11 survive termination." },

  { type: "h2", text: "9. Limitation of Liability" },
  { type: "p", text: "EXCEPT FOR (A) EITHER PARTY'S BREACH OF SECTION 6 (CONFIDENTIALITY), (B) LICENSEE'S BREACH OF SECTION 2 OR 3, OR (C) EITHER PARTY'S GROSS NEGLIGENCE OR WILLFUL MISCONDUCT: (I) NEITHER PARTY WILL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES; AND (II) EACH PARTY'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT WILL NOT EXCEED THE TOTAL FEES PAID OR PAYABLE BY LICENSEE UNDER THIS AGREEMENT IN THE 12 MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM." },

  { type: "h2", text: "10. Indemnification" },
  { type: "p", text: "10.1 By Licensor. Licensor will defend Licensee against any third-party claim that the Software, as delivered and used in accordance with this Agreement, infringes that third party's patent, copyright, or trade secret, and will indemnify Licensee for damages finally awarded, provided Licensee promptly notifies Licensor of the claim and allows Licensor to control the defense. Licensor may, at its option, procure the right for Licensee to continue using the Software, modify it to be non-infringing, or refund the depreciated License Fee if neither option is commercially reasonable." },
  { type: "p", text: "10.2 By Licensee. Licensee will defend and indemnify Licensor against third-party claims arising from Licensee Data, Licensee's use of the Software in violation of this Agreement or applicable law, or Licensee's negligence or willful misconduct." },

  { type: "h2", text: "11. Compliance and Independent Business" },
  { type: "p", text: "Licensee is solely responsible for ensuring its use of the Software complies with laws and regulations applicable to its warehouse and 3PL operations, including labor, safety, and data-privacy requirements. The Parties are independent contractors; nothing in this Agreement creates a partnership, joint venture, franchise, or agency relationship." },

  { type: "h2", text: "12. General Provisions" },
  { type: "p", text: "12.1 Assignment. Neither Party may assign this Agreement without the other Party's prior written consent, except that either Party may assign it in connection with a merger, acquisition, or sale of substantially all its assets, upon written notice." },
  { type: "p", text: "12.2 Notices. Notices under this Agreement must be in writing and delivered to the addresses set forth in the Order Form (or such other address as a Party designates in writing), by email with confirmation of receipt or by nationally recognized courier." },
  { type: "p", text: "12.3 Force Majeure. Neither Party is liable for delay or failure to perform caused by events beyond its reasonable control." },
  { type: "p", text: "12.4 Governing Law; Venue. This Agreement is governed by the laws of the jurisdiction specified in the Order Form, without regard to conflict-of-laws principles. The Parties consent to the exclusive jurisdiction of the courts specified in the Order Form for any dispute arising out of this Agreement." },
  { type: "p", text: "12.5 Entire Agreement; Amendment. This Agreement, together with the applicable Order Form, constitutes the entire agreement between the Parties regarding the Software and supersedes all prior agreements or representations. It may be amended only by a written instrument signed by both Parties." },
  { type: "p", text: "12.6 Severability; Waiver. If any provision of this Agreement is held unenforceable, the remaining provisions remain in full force. Failure to enforce any provision is not a waiver of future enforcement." },
  { type: "p", text: "12.7 Counterparts. This Agreement may be executed in counterparts, including by electronic signature, each of which is deemed an original." },

  { type: "party", label: "LICENSOR", name: "Classic Visions" },
  { type: "party", label: "LICENSEE", name: "As identified in the applicable Order Form" },
  { type: "note", text: "This Agreement is executed by the Parties through a signed Order Form referencing these terms. Site count, fees, seats, support term, and notice addresses for a given deployment are set out there, not duplicated here." },
];

function LicenseBlockView({ block }: { block: LicenseBlock }) {
  switch (block.type) {
    case "h1":
      return <h3 className="text-base font-bold tracking-tight">{block.text}</h3>;
    case "subtitle":
      return <p className="text-sm font-medium text-muted-foreground">{block.text}</p>;
    case "h2":
      return <h4 className="mt-4 text-sm font-semibold text-primary">{block.text}</h4>;
    case "p":
      return <p className="text-xs leading-relaxed text-muted-foreground">{block.text}</p>;
    case "li":
      return (
        <li className="ml-4 list-disc text-xs leading-relaxed text-muted-foreground">{block.text}</li>
      );
    case "and":
      return <p className="text-xs italic text-muted-foreground">and</p>;
    case "note":
      return (
        <p className="mt-2 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs italic leading-relaxed text-muted-foreground">
          {block.text}
        </p>
      );
    case "party":
      return (
        <div className="flex items-baseline gap-2 text-xs">
          <span className="font-semibold">{block.label}:</span>
          <span className="text-muted-foreground">{block.name}</span>
        </div>
      );
    default:
      return null;
  }
}

export function LicenseAgreementTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Software License and Support Agreement
        </CardTitle>
        <CardDescription>
          The standard license and support terms Classic Visions offers for the Warehouse Wizard software. Deployment-specific commercial terms are set in each client's Order Form.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[65vh] pr-4">
          <div className="grid gap-2 pb-4">
            {LICENSE_BLOCKS.map((block, index) => (
              <LicenseBlockView key={index} block={block} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
