
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProductionPage() {
  return (
    <div className="space-y-6 prose dark:prose-invert max-w-none">
      <h1>Production Management System</h1>
      <p className="lead">
        A Production Management System for a Modular Cabinet Installation Company that handles project-based fabrication, scheduling, material requisition, manpower deployment, and installation — synchronized with accounting, procurement, and client contract milestones (50%–40%–10% payment structure). The system must ensure real-time visibility, workflow automation, and cost-efficiency tracking from design approval to project turnover.
      </p>

      <h2>⚙️ 1. System Overview</h2>
      <p>The Production Department operates as the execution arm of the company — transforming client-approved designs into finished modular cabinets, ready for installation.</p>
      <p>The system will integrate:</p>
      <ul>
        <li>Project Production Planning</li>
        <li>Material Request & Inventory</li>
        <li>Fabrication Workflow Tracking</li>
        <li>Installation Scheduling</li>
        <li>Quality Assurance</li>
        <li>Labor Allocation & Productivity Tracking</li>
        <li>Progress Reporting & Communication</li>
      </ul>
      <p>Each project will have a unique code (linked to the Accounting System) for unified financial and operational tracking.</p>

      <h2>🧱 2. Project Production Lifecycle</h2>
      <p>Each project follows a structured production flow, monitored within the system.</p>
      <h3>Phases:</h3>
      <ol>
        <li><strong>Design & Approval Phase</strong>
          <ul>
            <li>Upload of design files (SketchUp, AutoCAD, PDF, etc.)</li>
            <li>Design revisions, material finalization, and approval logs.</li>
            <li>Design-to-production checklist.</li>
          </ul>
        </li>
        <li><strong>Material Requisition & Procurement Phase</strong>
          <ul>
            <li>Generate Material Requisition Form (MRF) from the approved design.</li>
            <li>Check inventory levels and available stock.</li>
            <li>Auto-forward shortages to Procurement for purchasing.</li>
            <li>Link MRF to corresponding project and cost center.</li>
          </ul>
        </li>
        <li><strong>Cutting & Fabrication Phase</strong>
          <ul>
            <li>Job orders assigned to specific personnel or teams.</li>
            <li>Each item/component is tagged (QR or barcode ready).</li>
            <li>Status tracking: “Pending → In Progress → Completed → QC Passed → Dispatched”.</li>
          </ul>
        </li>
        <li><strong>Assembly & Finishing Phase</strong>
          <ul>
            <li>Track assembly progress, lamination, edge-banding, painting, etc.</li>
            <li>Material consumption auto-deducted from inventory.</li>
          </ul>
        </li>
        <li><strong>Quality Control & Dispatch Phase</strong>
          <ul>
            <li>QC checklist per cabinet (dimension, finish, color, hardware fitment).</li>
            <li>Defects logged for rework tracking.</li>
            <li>Approval for site delivery or warehouse storage.</li>
          </ul>
        </li>
        <li><strong>Installation & Turnover Phase</strong>
          <ul>
            <li>Installation schedule per site and assigned crew.</li>
            <li>On-site punchlist tracking.</li>
            <li>Handover readiness status for final 10% billing.</li>
          </ul>
        </li>
      </ol>
      
      <h2>🧾 3. Material Requisition & Inventory Integration</h2>
      <p>Each project generates itemized material requests linked to design BOM (Bill of Materials).</p>
      <h4>Automation Goals:</h4>
      <ul>
          <li>Auto-check stock availability before request approval.</li>
          <li>Push purchase request to Procurement if item is out of stock.</li>
          <li>Sync material usage with Accounting for cost tracking.</li>
          <li>Enable barcode-based inventory deduction when items are issued to production.</li>
      </ul>

      <h2>👷 4. Manpower & Task Allocation</h2>
      <p>Track fabrication workload, task assignments, and labor efficiency.</p>
      <h4>Features:</h4>
      <ul>
          <li>Assign fabrication tasks by workstation (cutting, edge banding, assembly, finishing).</li>
          <li>Real-time progress updates per worker/team.</li>
          <li>Productivity KPIs: units per day, rework ratio, and idle time.</li>
          <li>Integration with payroll for labor cost analysis per project.</li>
      </ul>

      <h2>🧰 5. Production Planning & Scheduling</h2>
      <p>A Gantt-style or calendar-based planner to manage production workloads.</p>
       <h4>Automation Goals:</h4>
      <ul>
          <li>Auto-calculate estimated completion dates based on resource load.</li>
          <li>Flag overlapping projects or over-capacity periods.</li>
          <li>Sync production timeline with client milestones (for coordination with 40% payment phase).</li>
      </ul>

      <h2>🧾 6. Quality Control (QC) & Rework Management</h2>
      <p>Ensure every output passes standardized quality checks.</p>
      <h4>Automation Goals:</h4>
        <ul>
            <li>QC failures auto-log rework orders.</li>
            <li>Calculate rework rate % per project.</li>
            <li>Notify supervisor for items pending rework beyond SLA.</li>
        </ul>


      <h2>🚚 7. Installation Scheduling & Site Coordination</h2>
      <p>Link field operations with production completion.</p>
       <h4>Automation Goals:</h4>
        <ul>
            <li>Automatically notify installation team when cabinets are QC-approved.</li>
            <li>Sync with logistics for delivery scheduling.</li>
            <li>Log on-site progress and punchlist issues in real time.</li>
            <li>Connect completion status with Accounting for triggering final invoice (10%).</li>
        </ul>

      <h2>🏭 8. Production Dashboard & Reporting</h2>
      <p>A centralized dashboard for management oversight.</p>
      
      <h2>🧩 9. Integration Points</h2>
      <p>To ensure seamless inter-departmental flow:</p>
      
      <h2>🔒 10. Roles & Permissions</h2>

      <h2>🔍 11. Advanced Enhancements (AI + Automation Layer)</h2>
       <ul>
            <li>Predictive Scheduling: Estimate completion delays based on material readiness and labor workload.</li>
            <li>Smart Resource Allocation: Suggest optimal crew assignment based on skills and availability.</li>
            <li>Anomaly Detection: Identify projects with abnormal rework rates or slow progress.</li>
            <li>Visual Tracker: Real-time Kanban view of all projects and their phases.</li>
            <li>AR/3D Integration (Optional): View modular layouts and verify assembly before cutting.</li>
            <li>QR/Barcode Support: Scan item tags to track status across cutting → QC → dispatch.</li>
        </ul>

      <h2>📊 12. KPIs for Production Department</h2>
      
      <h2>🧠 13. Example Workflow Summary</h2>
      <p>Trigger Chain Example:</p>
      <ol>
        <li>Client approves design → system generates MRF.</li>
        <li>Inventory checks stock → Procurement notified for shortages.</li>
        <li>Production schedule auto-updates based on material readiness.</li>
        <li>Fabrication starts → QC logs defects → Rework auto-assigned.</li>
        <li>Cabinets dispatched → Installation progress monitored.</li>
        <li>Completion marked → Accounting triggers 40% or 10% invoice.</li>
        <li>Final turnover report generated for management.</li>
      </ol>
    </div>
  );
}
