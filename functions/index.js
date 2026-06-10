// Inside confirmDeleteBtn.addEventListener('click', async () => { ...

try {
    console.log("Deleting Firebase Auth user...");
    
    // Get student details from local state
    const student = studentsData[currentEditStudentId];
    
    // Call the Cloud Function
    const permanentStudentDeletion = firebase.functions().httpsCallable('permanentStudentDeletion');
    const result = await permanentStudentDeletion({
        uid: currentEditStudentId,
        course: student?.course || '',
        batch: student?.batch || student?.batchName || ''
    });

    // Required Debugging Logs
    console.log("Auth user deleted");
    console.log("Attendance deleted");
    console.log("History records removed");
    console.log("Firestore user removed");
    console.log("Batch/Class references updated");
    console.log("[Server]:", result.data.message);

    // Update Local UI
    delete studentsData[currentEditStudentId];
    delete attendanceData[currentEditStudentId];
    processAndRender(); // Re-render the student list
    
    showToast("Student permanently removed.", "success");
    closeDeleteModal();

} catch (error) {
    console.error("Deletion failed:", error);
    showToast("Critical Error: " + error.message, "error");
}
