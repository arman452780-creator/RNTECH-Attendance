const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK with full privileges
admin.initializeApp();

const db = admin.firestore();

/**
 * permanentStudentDeletion
 * 
 * A production-ready Callable function that performs a cascading deletion
 * of a student across the entire Firebase project (Auth + Firestore).
 * 
 * Flow:
 * 1. Verify Caller is a Teacher
 * 2. Delete from Firebase Authentication
 * 3. Delete Firestore User Document
 * 4. Batch Delete all Attendance Records
 * 5. Update Class Student Count
 */
exports.permanentStudentDeletion = functions.https.onCall(async (data, context) => {
    // --- 1. Security & Validation ---
    
    // Check if the caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'This action requires authentication.'
        );
    }

    const { uid, course, batch } = data;

    if (!uid) {
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'The student UID is required for deletion.'
        );
    }

    try {
        // Verify the caller is a teacher
        const callerRef = db.collection('users').doc(context.auth.uid);
        const callerSnap = await callerRef.get();
        const callerData = callerSnap.data();

        if (!callerData || callerData.role !== 'teacher') {
            throw new functions.https.HttpsError(
                'permission-denied', 
                'Access denied. Only teachers can permanently delete student records.'
            );
        }

        console.log(`[INIT] Permanent deletion started for student: ${uid} by teacher: ${context.auth.uid}`);

        // --- 2. Delete from Firebase Authentication ---
        console.log(`[AUTH] Deleting Firebase Auth user: ${uid}...`);
        try {
            await admin.auth().deleteUser(uid);
            console.log(`[AUTH] Auth user deleted successfully.`);
        } catch (authErr) {
            // If user is already gone from Auth, we continue with Firestore cleanup
            if (authErr.code === 'auth/user-not-found') {
                console.warn(`[AUTH] User not found in Auth, continuing with data cleanup.`);
            } else {
                throw authErr;
            }
        }

        // --- 3. Cascading Firestore Deletions ---
        
        // A. Delete Attendance Records (Batch deletion for efficiency)
        console.log(`[FIRESTORE] Querying attendance records for student: ${uid}`);
        const attendanceSnap = await db.collection('attendanceRecords')
            .where('studentID', '==', uid)
            .get();

        if (!attendanceSnap.empty) {
            const batchOp = db.batch();
            attendanceSnap.docs.forEach((doc) => {
                batchOp.delete(doc.ref);
            });
            await batchOp.commit();
            console.log(`[FIRESTORE] Deleted ${attendanceSnap.size} attendance records.`);
        }

        // B. Update Class Statistics (Decrement Student Count)
        if (course && batch) {
            console.log(`[FIRESTORE] Updating class stats for: ${course} - ${batch}`);
            const classQuery = await db.collection('classes')
                .where('courseName', '==', course)
                .where('batchName', '==', batch)
                .limit(1)
                .get();

            if (!classQuery.empty) {
                const classDoc = classQuery.docs[0];
                const currentCount = classDoc.data().studentCount || 0;
                if (currentCount > 0) {
                    await classDoc.ref.update({
                        studentCount: admin.firestore.FieldValue.increment(-1)
                    });
                    console.log(`[FIRESTORE] Decremented student count for class: ${classDoc.id}`);
                }
            }
        }

        // C. Finally, delete the primary User Document
        console.log(`[FIRESTORE] Deleting student document: users/${uid}`);
        await db.collection('users').doc(uid).delete();
        
        console.log(`[SUCCESS] Permanent deletion complete for UID: ${uid}`);
        
        return {
            success: true,
            message: `Student ${uid} and all associated data were successfully purged.`,
            deletedRecords: attendanceSnap.size
        };

    } catch (error) {
        console.error(`[ERROR] Deletion failed for student ${uid}:`, error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
