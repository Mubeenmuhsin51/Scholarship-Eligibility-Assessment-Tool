import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Candidate, ConsultancySettings } from '../types/scholarship';

async function loadImageDataUrl(src: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith('data:image/')) return src;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateCandidatePdfReport(
  candidate: Candidate,
  settings: ConsultancySettings,
  defaultCrestUrl: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 14;

  const navy: [number, number, number] = [11, 31, 58];
  const gold: [number, number, number] = [198, 155, 58];
  const slate: [number, number, number] = [51, 65, 85];
  const lightBg: [number, number, number] = [248, 250, 252];

  const logoSrc = settings.customLogoDataUrl || defaultCrestUrl;
  const logoData = await loadImageDataUrl(logoSrc);

  // Header Banner
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(...gold);
  doc.rect(0, 34, pageWidth, 1.5, 'F');

  if (logoData) {
    try {
      doc.addImage(logoData, 'JPEG', margin, 5, 22, 22);
    } catch {
      // Ignore image format fallback
    }
  }

  const textStartX = logoData ? margin + 27 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(settings.companyName || 'UBAID ULLAH ENTERPRISES', textStartX, 13);

  doc.setFontSize(10.5);
  doc.setTextColor(217, 180, 91);
  doc.text(settings.applicationName || 'International Scholarship-Assessment Tool', textStartX, 19.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text(settings.tagline || 'Empowering Global Academic Opportunities', textStartX, 25.5);

  doc.setFontSize(8);
  doc.text(`Ref: ${candidate.referenceCode}`, pageWidth - margin, 13, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin, 19, { align: 'right' });
  doc.text(`Status: ${candidate.assessmentStatus.toUpperCase()}`, pageWidth - margin, 25, { align: 'right' });

  y = 43;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  }

  function sectionHeader(num: string, title: string) {
    ensureSpace(16);
    doc.setFillColor(...lightBg);
    doc.rect(margin, y, pageWidth - margin * 2, 7.5, 'F');
    doc.setDrawColor(...gold);
    doc.line(margin, y + 7.5, pageWidth - margin, y + 7.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text(`${num}. ${title}`, margin + 2.5, y + 5.2);
    y += 11;
  }

  // 1 & 2. Candidate Information & Intended Programme
  sectionHeader('01', 'Candidate Information & Intended Academic Programme');
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: slate },
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: 'bold' },
    body: [
      ['Full Name', candidate.personalInfo.fullName, 'Email Address', candidate.personalInfo.email],
      ['Contact Number', candidate.personalInfo.contactNumber || 'N/A', 'Nationality', candidate.personalInfo.nationality || 'N/A'],
      [
        'Residence / Location',
        `${candidate.personalInfo.countryOfResidence || 'N/A'} (${candidate.personalInfo.currentLocation || 'N/A'})`,
        'DOB / Age',
        `${candidate.personalInfo.dateOfBirth || 'N/A'}${candidate.personalInfo.age ? ` (${candidate.personalInfo.age} yrs)` : ''}`,
      ],
      [
        'Intended Pathway',
        candidate.intendedProgramme.intendedDegree,
        'Research Field',
        candidate.intendedProgramme.preferredResearchField || 'Not specified',
      ],
      [
        'Target Countries',
        candidate.intendedProgramme.preferredCountries.join(', ') || 'Open / Flexible',
        'Admission Intake',
        `${candidate.intendedProgramme.preferredIntake} ${candidate.intendedProgramme.intendedAdmissionYear}`,
      ],
    ],
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 7;

  // 3. Academic Qualifications & English Proficiency
  sectionHeader('02', 'Academic Qualifications & English Proficiency');
  const q = candidate.qualifications;
  const ep = candidate.englishProficiency;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 8.3, cellPadding: 2.2, textColor: slate },
    headStyles: { fillColor: navy, textColor: [255, 255, 255] },
    head: [['Qualification / Test', 'Institution / Provider', 'Result / Score', 'Status']],
    body: [
      [
        'Matriculation',
        q.matriculation.institution || '—',
        q.matriculation.status === 'completed' ? `${q.matriculation.percentage}%` : q.matriculation.status,
        q.matriculation.evidenceVerified ? 'Verified' : 'Pending Verification',
      ],
      [
        'Intermediate / FSc',
        q.intermediate.institution || '—',
        q.intermediate.status === 'completed' ? `${q.intermediate.percentage}%` : q.intermediate.status,
        q.intermediate.evidenceVerified ? 'Verified' : 'Pending Verification',
      ],
      [
        "Bachelor's / BS",
        `${q.bachelors.degreeTitle || '—'} (${q.bachelors.university || '—'})`,
        q.bachelors.status === 'completed'
          ? `${q.bachelors.cgpa} / ${q.bachelors.totalScale} (${q.bachelors.completionYear || 'N/A'})`
          : q.bachelors.status,
        q.bachelors.evidenceVerified ? 'Verified' : 'Pending Verification',
      ],
      [
        "Master's / MS / MPhil",
        `${q.masters.degreeTitle || '—'} (${q.masters.university || '—'})`,
        q.masters.status === 'completed'
          ? `${q.masters.cgpa} / ${q.masters.totalScale} (${q.masters.completionYear || 'N/A'})`
          : q.masters.status,
        q.masters.evidenceVerified ? 'Verified' : 'Pending Verification',
      ],
      [
        'English Proficiency',
        ep.testType,
        ep.testType === 'None'
          ? 'Not Taken'
          : ep.testType === 'MOI'
          ? 'Medium of Instruction Certificate'
          : `Score: ${ep.overallScore} (Valid until ${ep.validityDate || 'N/A'})`,
        ep.evidenceVerified ? 'Verified' : 'Pending Verification',
      ],
    ],
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 7;

  // 4. Research Profile Summary
  sectionHeader('03', 'Research Profile, Publications & Experience');
  const rp = candidate.researchProfile;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8.2, cellPadding: 2.2, textColor: slate },
    body: [
      ['Previous Thesis Title', rp.previousThesisTitle || 'Not provided'],
      ['Intended Research Topic', rp.intendedResearchTopic || 'Not provided'],
      ['Research Interests', rp.researchInterests || 'Not provided'],
      ['Methodology & Techniques', `${rp.researchMethodology || '—'} | ${rp.researchTechniques || '—'}`],
      ['Lab & Software Skills', `${rp.laboratoryExpertise || '—'} | ${rp.scientificSoftware || '—'}`],
      [
        'Publications / Conferences / Experience',
        `${candidate.publications.length} publication(s) · ${candidate.conferences.length} conference(s) · ${candidate.assessment.experienceSummary.yearsDisplay} verified experience`,
      ],
    ],
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 7;

  // 5. Category-Wise Assessment & Overall Score
  sectionHeader('04', '100-Mark Automated Assessment Breakdown & Competitiveness');
  const a = candidate.assessment;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, textColor: slate },
    headStyles: { fillColor: navy, textColor: [255, 255, 255] },
    head: [['Category', 'Status', 'Marks', 'Assessment Explanation']],
    body: a.categories.map((c) => [
      `${c.id}. ${c.name}`,
      c.status.replace('_', ' ').toUpperCase(),
      c.applicable ? `${c.marksObtained} / ${c.maxMarks}` : 'N/A',
      c.explanation,
    ]),
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;

  ensureSpace(22);
  doc.setFillColor(...navy);
  doc.rect(margin, y, pageWidth - margin * 2, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(
    `Normalized Score: ${a.normalizedScore} / 100 (${a.totalObtained} / ${a.totalApplicableMax} Applicable Marks)`,
    margin + 4,
    y + 6.5
  );
  doc.setTextColor(217, 180, 91);
  doc.text(`Competitiveness Classification: ${a.classification}`, margin + 4, y + 12.5);
  y += 22;

  // 6. Degree-Level & Scholarship Eligibility
  if (candidate.aiEligibility) {
    sectionHeader('05', 'AI-Powered Degree & Scholarship Eligibility');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...slate);
    const summaryLines = doc.splitTextToSize(candidate.aiEligibility.executiveSummary, pageWidth - margin * 2);
    ensureSpace(summaryLines.length * 4.5 + 4);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 4.5 + 3;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: slate },
      headStyles: { fillColor: navy, textColor: [255, 255, 255] },
      head: [['Pathway', 'Overall Status', 'Evaluation Summary']],
      body: candidate.aiEligibility.pathways.map((p) => [p.pathway, p.overallStatus, p.summary]),
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 7;
  }

  // 7. Recommended Countries & Universities
  if (candidate.scholarshipMatches && candidate.scholarshipMatches.opportunities.length > 0) {
    sectionHeader('06', 'Recommended International Universities & Scholarships');
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { fontSize: 7.8, cellPadding: 2, textColor: slate },
      headStyles: { fillColor: navy, textColor: [255, 255, 255] },
      head: [['Country / University', 'Scholarship & Funding', 'Deadline', 'Verification']],
      body: candidate.scholarshipMatches.opportunities.slice(0, 10).map((o) => [
        `${o.country} — ${o.university}`,
        `${o.scholarshipName} (${o.fundingCoverage})`,
        o.applicationDeadline,
        `${o.verificationStatus.toUpperCase()} (${o.verificationDate})`,
      ]),
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 7;
  }

  // 8. Research Supervisor Matches
  if (candidate.supervisorMatches && candidate.supervisorMatches.supervisors.length > 0) {
    sectionHeader('07', 'Recommended Research Supervisors & Departments');
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.8, cellPadding: 2, textColor: slate },
      headStyles: { fillColor: navy, textColor: [255, 255, 255] },
      head: [['Supervisor & University', 'Department / Group', 'Alignment Rationale']],
      body: candidate.supervisorMatches.supervisors.slice(0, 8).map((s) => [
        `${s.professorName} (${s.university}, ${s.country})`,
        `${s.department}${s.researchGroup ? ` · ${s.researchGroup}` : ''}`,
        s.relevanceReason,
      ]),
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 7;
  }

  // 9. Weaknesses & Improvement Plan
  sectionHeader('08', 'Identified Weaknesses & Personalized Improvement Plan');
  const impItems =
    candidate.improvementPlan?.items.map((it) => [it.priority, it.category, `${it.actionTitle}: ${it.description}`, it.timeline]) ??
    a.recommendations.map((rec, i) => ['Priority', `Action ${i + 1}`, rec, 'Recommended']);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, textColor: slate },
    headStyles: { fillColor: navy, textColor: [255, 255, 255] },
    head: [['Priority', 'Area', 'Actionable Recommendation', 'Timeline']],
    body: impItems,
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  // 10. Disclaimer
  ensureSpace(22);
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  const disclaimerLines = doc.splitTextToSize(settings.reportDisclaimer, pageWidth - margin * 2);
  doc.text(disclaimerLines, margin, y);

  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${settings.companyName} · ${settings.applicationName} · Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  const safeName = candidate.personalInfo.fullName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${candidate.referenceCode}_${safeName}_Assessment_Report.pdf`);
}
