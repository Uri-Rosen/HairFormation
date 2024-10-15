document.addEventListener('DOMContentLoaded', function() {
    // קונפיגורציה של Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyD4W5VHGUKvP91v_zZRdWS8jStLhY-XnuU",
		authDomain: "hairformation-7fe08.firebaseapp.com",
		projectId: "hairformation-7fe08",
		storageBucket: "hairformation-7fe08.appspot.com",
		messagingSenderId: "936567620685",
		appId: "1:936567620685:web:477afb9e73cbc347ef4804"
    };
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // Get form elements
    const haircutTypeSelect = document.getElementById('haircutType');
    const dateInput = document.getElementById('date');
    const timeSelect = document.getElementById('time');
    const bookingForm = document.getElementById('bookingForm');
    const actionButtons = document.getElementById('actionButtons');

    // Define working hours per day (0: Sunday, 1: Monday, ..., 6: Saturday)
    const workingHours = {
        0: { start: "09:00", end: "17:30" }, // ראשון - Sunday
        1: null, // שני - Monday (closed)
        2: { start: "09:00", end: "17:30" }, // שלישי - Tuesday
        3: { start: "09:00", end: "17:30" }, // רביעי - Wednesday
        4: { start: "09:00", end: "17:30" }, // חמישי - Thursday
        5: { start: "09:00", end: "14:30" }, // שישי - Friday
        6: null // שבת - Saturday (closed)
    };

    // Define treatment durations in minutes
    const treatmentDurations = {
        'Woman': 30,
        'ManWithoutBeard': 20,
        'ManWithBeard': 30,
        'HairColoring': 20,
        'InoaRootColoring': 20,
        'BlowDry': 15,
        'Highlights': 25,        // גוונים
        'Ampoule': 20,           // אמפולה
        'KeratinTreatment': 45   // טיפול קרטין
    };

    // Define treatments that require WhatsApp contact instead of direct booking
    const whatsappTreatments = ['Highlights', 'Ampoule', 'KeratinTreatment'];

    let selectedDuration = null; // To store the duration of selected service
    let isWhatsAppTreatment = false; // Flag to determine if WhatsApp button should be shown

    // Initialize Datepicker on #date
    $('#date').datepicker({
        format: 'yyyy-mm-dd',
        language: 'he',
        orientation: 'bottom left',
        weekStart: 0, // Sunday
        daysOfWeekDisabled: [1,6], // Monday and Saturday
        autoclose: true,
        startDate: new Date(),
        todayHighlight: true,
        rtl: true
    }).on('changeDate', function(e) {
        // When date changes
        const selectedDate = e.date;
        const formattedDate = formatDate(selectedDate);
        dateInput.value = formattedDate;
        handleDateChange(selectedDate);
    });

    // Event listener for haircut type change
    haircutTypeSelect.addEventListener('change', function() {
        const selectedHaircutType = haircutTypeSelect.value;
        if (selectedHaircutType) {
            selectedDuration = treatmentDurations[selectedHaircutType];
            isWhatsAppTreatment = whatsappTreatments.includes(selectedHaircutType);
        } else {
            selectedDuration = null;
            isWhatsAppTreatment = false;
        }
        // Reset date and time selections
        dateInput.value = '';
        timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
        // Update action buttons
        updateActionButtons();
    });

    function updateActionButtons() {
        // Clear existing buttons
        actionButtons.innerHTML = '';

        if (isWhatsAppTreatment) {
            // Create WhatsApp Button
            const whatsappButton = document.createElement('button');
            whatsappButton.type = 'button';
            whatsappButton.className = 'btn btn-success btn-block';
            whatsappButton.id = 'whatsappButton';
            whatsappButton.textContent = 'צרו קשר בוואטסאפ';
            actionButtons.appendChild(whatsappButton);

            // Add event listener to WhatsApp button
            whatsappButton.addEventListener('click', function() {
                const firstName = document.getElementById('firstName').value.trim();
                const lastName = document.getElementById('lastName').value.trim();
                const phone = document.getElementById('phone').value.trim();
                const date = document.getElementById('date').value.trim(); // YYYY-MM-DD
                const time = document.getElementById('time').value.trim(); // HH:MM
                const haircutType = document.getElementById('haircutType').value.trim();

                // Perform validation
                const validationErrors = validateForm({
                    haircutType,
                    firstName,
                    lastName,
                    phone,
                    date,
                    time
                });

                if (validationErrors.length > 0) {
                    displayValidationErrors(validationErrors);
                    return;
                }

                // Prepare WhatsApp message
                const message = `שלום, שמי ${firstName} ${lastName} ואני אשמח לקבוע תור ל${getTreatmentLabel(haircutType)} בתאריך ה${formatDisplayDate(date)} בשעה ${time}.`;

                // WhatsApp phone number
                const phoneNumber = '972547224551'; // Replace with your salon's phone number in international format without '+'

                // Create WhatsApp URL
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

                // Open WhatsApp in a new tab
                window.open(whatsappUrl, '_blank');

                // Optionally, reset the form
                bookingForm.reset();
                // Reset datepicker
                $('#date').datepicker('update', '');
                timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
                updateActionButtons();
            });
        } else {
            // Create Book Appointment Button
            const bookButton = document.createElement('button');
            bookButton.type = 'submit';
            bookButton.className = 'btn btn-primary btn-block';
            bookButton.id = 'bookButton';
            bookButton.textContent = 'קבעו תור';
            actionButtons.appendChild(bookButton);
        }
    }

    function handleDateChange(selectedDate) {
        const day = selectedDate.getDay();
        const hours = workingHours[day];
        timeSelect.innerHTML = '<option value="">טוען שעות...</option>';

        if (!selectedDuration) {
            // If no service type selected, do not proceed with time slots
            timeSelect.innerHTML = '<option value="">בחרו סוג טיפול קודם</option>';
            return;
        }

        if (hours) {
            // Calculate the latest possible appointment start time
            const start = parseTime(hours.start);
            const end = parseTime(hours.end);
            const latestStart = new Date(end.getTime() - selectedDuration * 60000); // subtract duration

            // Generate time slots every 10 minutes between start and latestStart
            let times = generateTimeSlots(hours.start, formatTime(latestStart), 10);

            // If selected date is today, filter out past times
            const now = new Date();
            if (isSameDate(selectedDate, now)) {
                const currentTimeStr = formatTime(now);
                times = times.filter(time => time > currentTimeStr);
            }

            // Fetch existing appointments for the selected date
            const dateStr = formatDate(selectedDate);
            db.collection('appointments').where('date', '==', dateStr)
                .get()
                .then(querySnapshot => {
                    const bookedAppointments = [];
                    querySnapshot.forEach(doc => {
                        const data = doc.data();
                        bookedAppointments.push({
                            time: data.time,
                            duration: treatmentDurations[data.haircutType] || 10 // default duration
                        });
                    });

                    // Filter out times that are blocked by existing appointments
                    const availableTimes = times.filter(time => {
                        return !isTimeBlocked(time, bookedAppointments);
                    });

                    // Populate the timeSelect with available times
                    timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
                    if (availableTimes.length > 0) {
                        availableTimes.forEach(function(time) {
                            const option = document.createElement('option');
                            option.value = time;
                            option.textContent = time;
                            timeSelect.appendChild(option);
                        });
                    } else {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = 'אין שעות פנויות ביום זה';
                        timeSelect.appendChild(option);
                    }
                })
                .catch(error => {
                    console.error("Error getting appointments: ", error);
                    alert('אירעה שגיאה בטעינת השעות. אנא נסו שוב.');
                });
        } else {
            // Day is closed
            timeSelect.innerHTML = '<option value="">המספרה סגורה ביום זה</option>';
        }
    }

    // Helper function to get the display label for treatment types
    function getTreatmentLabel(value) {
        const labels = {
            'Woman': 'תספורת נשים',
            'ManWithoutBeard': 'תספורת גברים ללא זקן',
            'ManWithBeard': 'תספורת גברים עם זקן',
            'HairColoring': 'צבע שורש',
            'InoaRootColoring': 'צבע שורש אינואה',
            'BlowDry': 'פן',
            'Highlights': 'גוונים',
            'Ampoule': 'אמפולה',
            'KeratinTreatment': 'טיפול קרטין'
        };
        return labels[value] || value;
    }

    // Helper function to format date for display in WhatsApp message (DD/MM/YYYY)
    function formatDisplayDate(dateStr) {
        const parts = dateStr.split('-'); // "YYYY-MM-DD"
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    // Generate time slots between startTime and endTime with given interval (in minutes)
    function generateTimeSlots(startTime, endTime, interval) {
        const start = parseTime(startTime);
        const end = parseTime(endTime);
        const times = [];
        let currentTime = new Date(start);
        while (currentTime <= end) {
            times.push(formatTime(currentTime));
            currentTime.setMinutes(currentTime.getMinutes() + interval);
        }
        return times;
    }

    // Parse time string "HH:MM" into Date object (today's date)
    function parseTime(timeStr) {
        const parts = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        return date;
    }

    // Format Date object into "HH:MM" string
    function formatTime(date) {
        const hours = ('0' + date.getHours()).slice(-2);
        const minutes = ('0' + date.getMinutes()).slice(-2);
        return `${hours}:${minutes}`;
    }

    // Check if two dates are the same day
    function isSameDate(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    // Format Date object into "YYYY-MM-DD"
    function formatDate(date) {
        const year = date.getFullYear();
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        return `${year}-${month}-${day}`;
    }

    // Check if a given time slot is blocked by any booked appointments
    function isTimeBlocked(time, bookedAppointments) {
        const [hour, minute] = time.split(':').map(Number);
        const appointmentStart = new Date();
        appointmentStart.setHours(hour, minute, 0, 0);
        const appointmentEnd = new Date(appointmentStart.getTime() + selectedDuration * 60000);

        for (let appointment of bookedAppointments) {
            const [aHour, aMinute] = appointment.time.split(':').map(Number);
            const aStart = new Date();
            aStart.setHours(aHour, aMinute, 0, 0);
            const aEnd = new Date(aStart.getTime() + appointment.duration * 60000);

            // Check for overlap
            if (appointmentStart < aEnd && appointmentEnd > aStart) {
                return true;
            }
        }
        return false;
    }

    // Form validation function
    function validateForm(fields) {
        const errors = [];

        if (!fields.haircutType) {
            errors.push({ field: 'haircutType', message: 'אנא בחרו סוג טיפול.' });
        }

        if (!fields.firstName) {
            errors.push({ field: 'firstName', message: 'אנא הזינו את השם הפרטי.' });
        }

        if (!fields.lastName) {
            errors.push({ field: 'lastName', message: 'אנא הזינו את שם המשפחה.' });
        }

        if (!fields.phone) {
            errors.push({ field: 'phone', message: 'אנא הזינו את מספר הטלפון.' });
        } else if (!/^[0-9]{10}$/.test(fields.phone)) {
            errors.push({ field: 'phone', message: 'אנא הזינו מספר טלפון תקין (10 ספרות).' });
        }

        if (!fields.date) {
            errors.push({ field: 'date', message: 'אנא בחרו תאריך.' });
        }

        if (!fields.time) {
            errors.push({ field: 'time', message: 'אנא בחרו שעה.' });
        }

        return errors;
    }

    // Function to display validation errors
    function displayValidationErrors(errors) {
        // Reset all validation states
        const inputs = bookingForm.querySelectorAll('.form-control');
        inputs.forEach(input => {
            input.classList.remove('is-invalid');
        });

        // Add invalid class and set feedback message
        errors.forEach(error => {
            const input = document.getElementById(error.field);
            if (input) {
                input.classList.add('is-invalid');
                const feedback = input.nextElementSibling;
                if (feedback && feedback.classList.contains('invalid-feedback')) {
                    feedback.textContent = error.message;
                }
            }
        });

        // Focus on the first invalid input
        if (errors.length > 0) {
            const firstErrorField = document.getElementById(errors[0].field);
            if (firstErrorField) {
                firstErrorField.focus();
            }
        }
    }

    // Handle form submission
    if (bookingForm) {
        bookingForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const date = document.getElementById('date').value.trim(); // YYYY-MM-DD
            const time = document.getElementById('time').value.trim(); // HH:MM
            const haircutType = document.getElementById('haircutType').value.trim();

            const validationErrors = validateForm({
                haircutType,
                firstName,
                lastName,
                phone,
                date,
                time
            });

            if (validationErrors.length > 0) {
                displayValidationErrors(validationErrors);
                return;
            }

            if (isWhatsAppTreatment) {
                // Handle WhatsApp Contact
                const message = `שלום, שמי ${firstName} ${lastName} ואני אשמח לקבוע תור ל${getTreatmentLabel(haircutType)} בתאריך ה${formatDisplayDate(date)} בשעה ${time}.`;

                // WhatsApp phone number
                const phoneNumber = '972547224551'; // Replace with your salon's phone number in international format without '+'

                // Create WhatsApp URL
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

                // Open WhatsApp in a new tab
                window.open(whatsappUrl, '_blank');

                // Optionally, reset the form
                bookingForm.reset();
                // Reset datepicker
                $('#date').datepicker('update', '');
                timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
                updateActionButtons();
            } else {
                // Handle Firestore Booking
                // Check if appointment is still available (prevent race conditions)
                db.collection('appointments').where('date', '==', date).where('time', '==', time)
                    .get()
                    .then(querySnapshot => {
                        if (querySnapshot.empty) {
                            // Appointment is available, proceed to book
                            db.collection('appointments').add({
                                firstName: firstName,
                                lastName: lastName,
                                phone: phone,
                                date: date,
                                time: time,
                                haircutType: haircutType
                            })
                            .then(() => {
                                alert('התור נקבע בהצלחה!');
                                bookingForm.reset();
                                // Reset datepicker
                                $('#date').datepicker('update', '');
                                timeSelect.innerHTML = '<option value="">בחרו שעה</option>';
                            })
                            .catch(error => {
                                console.error("Error adding appointment: ", error);
                                alert('אירעה שגיאה בקביעת התור. אנא נסו שוב.');
                            });
                        } else {
                            alert('התור שבחרתם כבר נתפס. אנא בחרו שעה אחרת.');
                            // Refresh available times
                            handleDateChange(new Date(date));
                        }
                    })
                    .catch(error => {
                        console.error("Error checking appointment: ", error);
                        alert('אירעה שגיאה בבדיקת זמינות התור. אנא נסו שוב.');
                    });
            }
        });
    }

    // Function to delete past appointments (optional, can be run periodically via Cloud Functions)
    function deletePastAppointments() {
        const today = formatDate(new Date()); // 'YYYY-MM-DD'

        db.collection('appointments').where('date', '<', today)
            .get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    console.log('אין תורים שהעברו למחיקה.');
                    return;
                }

                const batch = db.batch();
                querySnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });

                return batch.commit();
            })
            .then(() => {
                if (!querySnapshot.empty) {
                    console.log('תורים שהעברו נמחקו בהצלחה.');
                }
            })
            .catch(error => {
                console.error('שגיאה במחיקת תורים שהעברו: ', error);
            });
    }
});
