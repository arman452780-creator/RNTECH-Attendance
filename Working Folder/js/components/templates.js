// templates.js - Local Bundled Templates for RN-TECH
// This script injects all necessary <template> elements into the DOM on load.
// By doing this via JS, we ensure templates are instantly available across all pages without duplicate HTML.

const templatesHTML = `
<div id="app-local-templates" style="display: none;">

    <!-- ============================================== -->
    <!-- TEACHER PORTAL TEMPLATES                       -->
    <!-- ============================================== -->

    <!-- Teacher Dashboard: Class Card -->
    <template id="tpl-teacher-class-card">
        <div class="class-card" data-bind-dynamic-class="autoStatus.status" data-class-prefix="active-">
            <div class="class-info">
                <h4 data-bind-text="courseName">Course Name</h4>
                <p><i class="fa-solid fa-layer-group"></i> <span data-bind-text="batchName">Batch</span><span data-bind-text="subjectFormatted"></span></p>
                <p><i class="fa-regular fa-clock"></i> <span data-bind-text="timeRange">Time</span></p>
            </div>
            <div class="class-footer">
                <span class="student-count"><i class="fa-solid fa-users"></i> <span data-bind-text="studentCount">0</span> Students</span>
                <div style="display:flex;gap:6px;align-items:center;">
                    <span class="dash-type-badge" data-bind-class="lab:isLab;theory:isTheory"><i class="fa-solid" data-bind-class="fa-computer:isLab;fa-book:isTheory"></i> <span data-bind-text="classTypeUpper">THEORY</span></span>
                    <span class="status-indicator" data-bind-dynamic-class="autoStatus.status" data-class-prefix="">
                        <span data-bind-html="statusHTML"></span>
                    </span>
                </div>
            </div>
        </div>
    </template>

    <!-- Teacher Dashboard: Recent Activity Row -->
    <template id="tpl-teacher-activity-row">
        <div class="activity-item">
            <div class="act-avatar" data-bind-text="initials">S</div>
            <div class="act-content">
                <span class="act-name" data-bind-text="studentName">Student</span>
                <span class="act-meta"><span data-bind-text="resolvedCourse">Course</span> • <span data-bind-text="timeStr">Time</span></span>
            </div>
            <span class="act-status" data-bind-text="statusText" data-bind-dynamic-class="attendanceStatus" data-class-prefix="">PRESENT</span>
        </div>
    </template>

    <!-- ============================================== -->
    <!-- STUDENT PORTAL TEMPLATES                       -->
    <!-- ============================================== -->

    <!-- Student Dashboard: Class Card -->
    <template id="tpl-student-class-card">
        <div class="class-card" data-bind-dynamic-class="autoStatus.status" data-class-prefix="live-">
            <div class="class-main">
                <span class="class-subject" data-bind-text="batchName">Batch</span>
                <h4 class="class-name" data-bind-text="subjectTitle">Subject</h4>
            </div>
            <div class="class-meta">
                <div class="meta-item">
                    <i class="fa-solid fa-calendar-day"></i>
                    <span data-bind-text="todayFullName">Day</span>
                </div>
                <div class="meta-item">
                    <i class="fa-regular fa-clock"></i>
                    <span data-bind-text="timeRange">Time</span>
                </div>
                <div class="meta-item">
                    <i class="fa-solid fa-user-tie"></i>
                    <span data-bind-text="teacherName">Teacher</span>
                </div>
            </div>
            <div class="class-status-row" style="display: flex; align-items: center; gap: 10px; margin-top: auto;">
                <span class="dash-type-badge" data-bind-dynamic-class="classType" data-class-prefix="">
                    <i class="fa-solid" data-bind-class="fa-computer:isLab;fa-book:isTheory"></i> 
                    <span data-bind-text="classTypeUpper">THEORY</span>
                </span>
                <span class="class-status-badge" data-bind-dynamic-class="autoStatus.status" data-class-prefix="status-">
                    <span data-bind-html="statusHTML"></span>
                </span>
            </div>
        </div>
    </template>

    <!-- Student Dashboard: Activity Row -->
    <template id="tpl-student-activity-row">
        <div class="activity-item">
            <div class="act-icon" data-bind-dynamic-class="mappedStatus" data-class-prefix="act-">
                <i class="fa-solid" data-bind-class="fa-check:isPresent;fa-clock:isLate;fa-xmark:isAbsent"></i>
            </div>
            <div class="act-info">
                <span class="act-title" data-bind-text="courseName">Course</span>
                <span class="act-time" data-bind-text="dateStr">Date</span>
            </div>
            <span class="act-status-text" data-bind-text="statusText" data-bind-class="success-color:isPresent;warning-color:isLate;danger-color:isAbsent">
                PRESENT
            </span>
        </div>
    </template>

</div>
`;

// Inject into DOM immediately on script execution
document.write(templatesHTML);

// Optional: Fallback for frameworks/defer loading if document.write is blocked
if (!document.getElementById('app-local-templates')) {
    const div = document.createElement('div');
    div.innerHTML = templatesHTML;
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(div.firstElementChild);
    });
}
