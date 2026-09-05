import type enIN from './en-IN';

/**
 * Typed against the `en-IN` catalogue, so a missing key here fails the build.
 */
const hiIN: Record<keyof typeof enIN, string> = {
  /* ——— Identity ——— */
  'app.name': 'स्वास्थ्य सेतु',
  'app.tagline': 'सही मरीज़ → सही इलाज → सही केंद्र → सही समय',
  'app.language': 'भाषा',
  'app.language.en': 'English',
  'app.language.hi': 'हिन्दी',

  /* ——— Roles and the switcher ——— */
  'role.patient': 'मरीज़',
  'role.asha': 'आशा / ए.एन.एम.',
  'role.doctor': 'डॉक्टर',
  'role.self': 'स्वयं',
  'role.patient.blurb': 'अपनी शिकायत बताएँ और अपना रिकॉर्ड देखें।',
  'role.asha.blurb': 'मरीज़ दर्ज करें, वाइटल्स लें, अपॉइंटमेंट बुक करें।',
  'role.doctor.blurb': 'इतिहास देखें, निर्णय दर्ज करें, रेफ़रल उठाएँ।',
  'role.switch': 'भूमिका बदलें',
  'role.switch.title': 'भूमिका चुनें',
  'role.active': 'वर्तमान भूमिका',
  'role.choose': 'यह डिवाइस कौन चला रहा है?',
  'role.demoNotice':
    'भूमिका बदलना हैकाथॉन प्रदर्शन की सुविधा है, प्रमाणीकरण नहीं। कोई साइन-इन या ओ.टी.पी. नहीं, और सारा डेटा केवल प्रदर्शन के लिए बनाया गया है।',
  'role.guard.redirect': 'आगे बढ़ने के लिए भूमिका चुनें।',

  /* ——— Navigation ——— */
  'nav.home': 'होम',
  'nav.record': 'मेरा रिकॉर्ड',
  'nav.intake': 'नई शिकायत',
  'nav.language': 'भाषा',
  'nav.patients': 'मरीज़',
  'nav.register': 'दर्ज करें',
  'nav.referrals': 'रेफ़रल',
  'nav.board': 'रेफ़रल बोर्ड',
  'nav.more': 'अधिक',

  /* ——— Intake ——— */
  'intake.title': 'नई शिकायत',
  'intake.subject': 'किसके लिए दर्ज हो रहा है',
  'intake.symptoms.label': 'क्या तकलीफ़ है?',
  'intake.symptoms.placeholder': 'अपने शब्दों में तकलीफ़ बताएँ',
  'intake.symptoms.hint': 'भेजने से पहले आप लिखा हुआ बदल सकते हैं।',
  'intake.submit': 'सलाह लें',
  'intake.submitting': 'आकलन हो रहा है…',
  'intake.voice.start': 'बोलें',
  'intake.voice.stop': 'रोकें',
  'intake.voice.unavailable':
    'इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। तकलीफ़ टाइप करें।',
  'intake.picker.label': 'मरीज़ चुनें',
  'intake.picker.empty': 'शिकायत दर्ज करने से पहले मरीज़ चुनें।',
  'intake.picker.new': 'नया मरीज़ दर्ज करें',
  'intake.age': 'उम्र',
  'intake.gender': 'लिंग',
  'intake.village': 'गाँव',
  'intake.phone': 'फ़ोन',
  'intake.name': 'पूरा नाम',

  /* ——— Vitals ——— */
  'vitals.title': 'वाइटल्स',
  'vitals.optional': 'सभी खाने वैकल्पिक हैं',
  'vitals.bloodPressure': 'रक्तचाप',
  'vitals.bloodPressure.placeholder': '120/80',
  'vitals.pulse': 'नाड़ी',
  'vitals.pulse.unit': 'प्रति मिनट',
  'vitals.temperature': 'तापमान',
  'vitals.temperature.unit': '°से.',
  'vitals.spo2': 'ऑक्सीजन (SpO₂)',
  'vitals.spo2.unit': '%',
  'vitals.weight': 'वज़न',
  'vitals.weight.unit': 'कि.ग्रा.',
  'vitals.none': 'कोई वाइटल्स दर्ज नहीं',

  /* ——— Triage result ——— */
  'triage.title': 'ए.आई. सुझाव',
  'triage.risk': 'प्राथमिकता',
  'triage.risk.low': 'कम',
  'triage.risk.medium': 'मध्यम',
  'triage.risk.high': 'उच्च',
  'triage.nextStep': 'अब क्या करें',
  'triage.matched': 'मिले हुए शब्द',
  'triage.source.gemini': 'ए.आई. आकलन',
  'triage.source.fallback': 'शब्द-आधारित वैकल्पिक आकलन',
  'triage.readAloud': 'सुनें',
  'triage.assessing': 'आकलन हो रहा है…',

  /* ——— Advisory framing ——— */
  'advisory.notice':
    'यह ए.आई. से बना सहायक सुझाव है। यह रोग की पहचान नहीं है। निर्णय डॉक्टर दर्ज करते हैं।',
  'advisory.aiSuggestion': 'ए.आई. सुझाव',
  'advisory.doctorDecision': 'डॉक्टर का निर्णय',
  'advisory.summary.unavailable':
    'ए.आई. सारांश उपलब्ध नहीं — पूरा विज़िट इतिहास दिखाया जा रहा है।',
  'advisory.summary.retry': 'सारांश फिर से लें',
  'advisory.source.template': 'दर्ज विज़िट से बनाया गया। कोई क्लीनिकल अनुमान नहीं।',

  /* ——— Appointment and token ——— */
  'appointment.title': 'आपका अपॉइंटमेंट',
  'appointment.facility': 'यहाँ जाएँ',
  'appointment.token': 'टोकन',
  'appointment.type.phc': 'प्राथमिक स्वास्थ्य केंद्र',
  'appointment.type.chc': 'सामुदायिक स्वास्थ्य केंद्र',
  'appointment.type.district_hospital': 'ज़िला अस्पताल',
  'appointment.distance': 'दूरी',
  'appointment.queue': 'प्रतीक्षा में लोग',
  'appointment.book': 'अपॉइंटमेंट बुक करें',
  'appointment.status.scheduled': 'तय',
  'appointment.status.checked_in': 'पहुँच गए',
  'appointment.status.completed': 'पूरा',
  'appointment.status.cancelled': 'रद्द',
  'appointment.none': 'अभी कोई अपॉइंटमेंट नहीं',

  /* ——— Referrals ——— */
  'referral.title': 'रेफ़रल',
  'referral.raise': 'रेफ़रल उठाएँ',
  'referral.to': 'यहाँ भेजें',
  'referral.from': 'कहाँ से',
  'referral.reason': 'कारण',
  'referral.status.referred': 'रेफ़र किया',
  'referral.status.in_progress': 'चल रहा है',
  'referral.status.completed': 'पूरा हुआ',
  'referral.advance': 'आगे बढ़ाएँ',
  'referral.closed': 'बंद',
  'referral.none': 'कोई रेफ़रल नहीं',
  'referral.error.same': 'रेफ़रल पहले से इसी स्थिति में है।',
  'referral.error.terminal': 'पूरा हो चुका रेफ़रल फिर नहीं बदला जा सकता।',
  'referral.error.illegal': 'वर्तमान स्थिति से यह कदम मान्य नहीं है।',
  'referral.error.notFound': 'यह रेफ़रल अब मौजूद नहीं है।',

  /* ——— Prescription ——— */
  'prescription.title': 'दवा पर्ची',
  'prescription.medicines': 'दवाइयाँ',
  'prescription.dosage': 'ख़ुराक',
  'prescription.notes': 'टिप्पणी',
  'prescription.save': 'पर्ची सहेजें',
  'prescription.none': 'कोई दवा पर्ची दर्ज नहीं',
  'prescription.error.medicinesRequired': 'कम से कम एक दवा लिखें।',

  /* ——— Clinical decision ——— */
  'decision.title': 'डॉक्टर का निर्णय',
  'decision.assessment': 'अंतिम आकलन',
  'decision.plan': 'योजना',
  'decision.risk': 'डॉक्टर की प्राथमिकता',
  'decision.save': 'निर्णय दर्ज करें',
  'decision.none': 'अभी कोई निर्णय दर्ज नहीं',
  'decision.by': 'दर्ज करने वाले',
  'decision.differs': 'डॉक्टर की प्राथमिकता ए.आई. सुझाव से अलग है।',
  'decision.error.assessmentRequired': 'अंतिम आकलन लिखें।',

  /* ——— Timeline ——— */
  'timeline.title': 'रिकॉर्ड का क्रम',
  'timeline.author': 'दर्ज करने वाले',
  'timeline.entry.record': 'विज़िट',
  'timeline.entry.prescription': 'दवा पर्ची',
  'timeline.entry.referral': 'रेफ़रल',
  'timeline.entry.appointment': 'अपॉइंटमेंट',
  'timeline.summary.title': 'इतिहास का सारांश',
  'timeline.empty': 'अभी कुछ दर्ज नहीं हुआ।',

  /* ——— Doctor panel ——— */
  'doctor.title': 'मरीज़',
  'doctor.review': 'देखें',
  'doctor.currentComplaint': 'वर्तमान शिकायत',
  'doctor.priorVisits': 'पिछली विज़िट',
  'doctor.open': 'रिकॉर्ड खोलें',

  /* ——— Empty states ——— */
  'empty.patient.record': 'अभी कोई विज़िट नहीं। शिकायत बताकर रिकॉर्ड शुरू करें।',
  'empty.patient.appointment': 'अभी कोई अपॉइंटमेंट नहीं। शिकायत बताएँ और पाएँ।',
  'empty.patient.referral': 'कोई रेफ़रल नहीं। ज़रूरत पड़ने पर डॉक्टर उठाते हैं।',
  'empty.asha.patients': 'मरीज़ का कार्ड स्कैन करें, या सूची से चुनें।',
  'empty.asha.worklist':
    'आपकी सूची में अभी कोई मरीज़ नहीं। पहला मरीज़ दर्ज करें, और उसका रिकॉर्ड उसी विज़िट से शुरू हो जाएगा।',
  'empty.doctor.patients': 'कोई मरीज़ प्रतीक्षा में नहीं।',
  'empty.referral.board': 'इस कॉलम में कोई रेफ़रल नहीं।',

  /* ——— Connectivity ——— */
  'connectivity.online': 'ऑनलाइन',
  'connectivity.offline': 'ऑफ़लाइन — आपकी जानकारी इस डिवाइस पर सुरक्षित है',
  'connectivity.pending': 'सिंक होने का इंतज़ार',
  'connectivity.failed': 'विफल',
  'connectivity.retry': 'फिर से सिंक करें',

  /* ——— Mock features ——— */
  'mock.badge': 'प्रदर्शन',
  'mock.notice': 'यह हिस्सा प्रदर्शन के लिए बनाया गया है।',

  /* ——— Demo controls ——— */
  'demo.reset': 'प्रदर्शन डेटा रीसेट करें',
  'demo.reset.caption': 'इस सत्र में बनाया गया सब कुछ हट जाएगा।',

  /* ——— Validation and generic ——— */
  'validation.required': 'यह खाना ज़रूरी है।',
  'validation.numeric': 'संख्या लिखें।',
  'validation.age': '0 से 120 के बीच उम्र लिखें।',
  'validation.bloodPressure': 'ऊपर/नीचे के रूप में लिखें, जैसे 120/80।',
  'action.save': 'सहेजें',
  'action.cancel': 'रद्द करें',
  'action.back': 'पीछे',
  'action.retry': 'फिर कोशिश करें',
  'action.close': 'बंद करें',
  'state.loading': 'लोड हो रहा है…',
  'state.error': 'कुछ गड़बड़ हो गई।',

  /* ——— The symptom chat ——— */
  'chat.title': 'बताइए क्या तकलीफ़ है',
  'chat.opening':
    'नमस्ते। बताइए आपको क्या तकलीफ़ है। मैं दो-तीन छोटे सवाल पूछूँगा, फिर बताऊँगा कि क्या करना है।',
  'chat.composer.placeholder': 'अपना जवाब यहाँ लिखें',
  'chat.composer.label': 'आपका जवाब',
  'chat.send': 'भेजें',
  'chat.thinking': 'आपका जवाब पढ़ा जा रहा है…',
  'chat.progress': '{max} में से {n} सवाल',
  'chat.quickReplies': 'कोई जवाब दबाएँ',
  'chat.restart': 'फिर से शुरू करें',
  'chat.continue': 'आगे बढ़ें',
  'chat.assessment.title': 'यह क्या लगता है',
  'chat.assessment.nextStep': 'अब क्या करें',
  'chat.assessment.redFlags': 'इन बातों पर ध्यान रखें',
  'chat.you': 'आप',
  'chat.assistant': 'स्वास्थ्य सहायक',
  'chat.error':
    'ऑनलाइन आकलन पूरा नहीं हो सका। शब्द-आधारित नतीजा दिखाया जा रहा है।',
  'chat.transcript': 'आपने जो बताया',
  'chat.conversation': 'भर्ती के समय की बातचीत',
  'chat.conversation.hint': 'यह आकलन इन सवाल-जवाब से निकला है।',
  'chat.empty': 'शुरू करने के लिए जवाब लिखें या दबाएँ।',

  /* ——— Triage additions ——— */
  'triage.redFlags': 'चेतावनी के लक्षण',
  'triage.result.title': 'सलाह',

  /* ——— Vitals validation ——— */
  'vitals.error.numeric': 'संख्या लिखें, जैसे 78।',
  'vitals.error.bloodPressure': 'ऊपर/नीचे के रूप में लिखें, जैसे 120/80।',
  'vitals.error.range': 'यह मान अपेक्षित सीमा से बाहर है।',
  'vitals.recorded': 'वाइटल्स दर्ज हो गए',

  /* ——— Appointment additions ——— */
  'appointment.teleconsult': 'टेली-परामर्श',
  'appointment.next': 'आपका अगला अपॉइंटमेंट',
  'appointment.confirmed': 'अपॉइंटमेंट तय हो गया',

  /* ——— Referral additions ——— */
  'referral.raise.title': 'रेफ़रल उठाएँ',
  'referral.to.placeholder': 'केंद्र या विशेषज्ञ',
  'referral.reason.placeholder': 'यह रेफ़रल क्यों ज़रूरी है?',
  'referral.error.toRequired': 'केंद्र या विशेषज्ञ का नाम लिखें।',
  'referral.rejected': 'यह बदलाव मान्य नहीं',
  'referral.updatedAt': 'अंतिम बदलाव',

  /* ——— Prescription additions ——— */
  'prescription.medicines.placeholder': 'हर पंक्ति में एक दवा',
  'prescription.dosage.placeholder': 'जैसे 3 दिन तक दिन में तीन बार एक गोली',
  'prescription.notes.placeholder': 'कब लौटना है, क्या नहीं करना है',

  /* ——— Decision ——— */
  'decision.aiSuggestion': 'ए.आई. सुझाव',
  'decision.doctorDecision': 'डॉक्टर का निर्णय',
  'decision.assessment.placeholder': 'इस विज़िट का अंतिम आकलन',
  'decision.plan.placeholder': 'इलाज की योजना और अगली जाँच',
  'decision.recorded': 'निर्णय दर्ज हो गया',

  /* ——— Timeline: Record_Author ——— */
  'timeline.author.patient': 'मरीज़ ने दर्ज किया',
  'timeline.author.asha': 'आशा कार्यकर्ता ने दर्ज किया',
  'timeline.author.doctor': 'डॉक्टर ने दर्ज किया',
  'timeline.at': 'तारीख़',

  /* ——— Patient workspace ——— */
  'patient.title': 'मेरा स्वास्थ्य',
  'patient.myRecord': 'मेरा रिकॉर्ड',
  'patient.myStatus': 'मेरी स्थिति',
  'patient.myAppointment': 'मेरा अपॉइंटमेंट',
  'patient.myReferrals': 'मेरे रेफ़रल',
  'patient.language.select': 'अपनी भाषा चुनें',
  'patient.language.saved': 'भाषा सहेज ली गई',
  'patient.register.title': 'मरीज़ दर्ज करें',
  'patient.register.name': 'पूरा नाम',
  'patient.register.age': 'उम्र',
  'patient.register.gender': 'लिंग',
  'patient.register.gender.female': 'महिला',
  'patient.register.gender.male': 'पुरुष',
  'patient.register.gender.other': 'अन्य',
  'patient.register.village': 'गाँव',
  'patient.register.district': 'ज़िला',
  'patient.register.phone': 'फ़ोन',
  'patient.register.language': 'पसंदीदा भाषा',
  'patient.register.save': 'दर्ज करें और आगे बढ़ें',
  'patient.register.saved': 'मरीज़ दर्ज हो गया',
  'patient.select': 'मरीज़ चुनें',
  'patient.selected': 'किसके लिए दर्ज हो रहा है',

  /* ——— Doctor workspace ——— */
  'doctor.queue': 'आज की कतार',
  'doctor.panel': 'मरीज़ पैनल',
  'doctor.summary.title': 'इतिहास का सारांश',
  'doctor.summary.unavailable':
    'ए.आई. सारांश उपलब्ध नहीं — पूरा विज़िट इतिहास दिखाया जा रहा है।',
  'doctor.summary.retry': 'सारांश फिर से लें',
  'doctor.summary.loading': 'इतिहास का सारांश बन रहा है…',
  'doctor.vitalsAndSymptoms': 'वाइटल्स और लक्षण',
  'doctor.noRecords': 'इस मरीज़ की कोई विज़िट दर्ज नहीं है।',

  /* ——— Medicine stock ——— */
  'stock.title': 'दवा का स्टॉक',
  'stock.medicine': 'दवा',
  'stock.quantity': 'मात्रा',
  'stock.level': 'स्थिति',
  'stock.level.in_stock': 'उपलब्ध',
  'stock.level.low': 'कम',
  'stock.level.out': 'ख़त्म',
  'stock.reorder': 'फिर से मँगाएँ',
  'stock.reorder.threshold': '{n} से कम पर फिर मँगाएँ',
  'stock.heuristic': 'यह बीज डेटा पर बनी पहली-पीढ़ी की गणना है, कोई प्रशिक्षित मॉडल नहीं।',
  'stock.empty': 'इस केंद्र का कोई स्टॉक दर्ज नहीं।',
  'stock.seedNotice':
    'मात्राएँ बीज डेटा की `medicine_stock` पंक्तियों से आती हैं, किसी लाइव इन्वेंटरी से नहीं। स्थिति का मतलब है मात्रा की तुलना फिर-मँगाने की सीमा से — यहाँ कुछ भी अनुमान से नहीं निकाला गया।',
  'stock.empty.filtered':
    'इस खोज से कोई दवा नहीं मिली। खोज का खाना ख़ाली करें, या पूरी सूची देखने के लिए "कम और ख़त्म" वाला फ़िल्टर बंद करें।',
  'stock.search': 'दवा खोजें',
  'stock.search.placeholder': 'पैरासिटामोल, ओ.आर.एस., इंसुलिन…',
  'stock.filter.onlyShortages': 'केवल कम और ख़त्म दिखाएँ',
  'stock.shownOfTotal': '{total} दवाओं में से {shown}',
  'stock.facility': 'केंद्र',
  'stock.facility.home': 'आपकी तैनाती',
  'stock.facility.all': 'सभी केंद्र',

  /* ——— Aggregate dashboard ——— */
  'dashboard.title': 'ज़िला डैशबोर्ड',
  'dashboard.patients': 'मरीज़',
  'dashboard.records': 'दर्ज विज़िट',
  'dashboard.byRisk': 'प्राथमिकता के अनुसार',
  'dashboard.byFacility': 'केंद्र के अनुसार अपॉइंटमेंट',
  'dashboard.referrals': 'स्थिति के अनुसार रेफ़रल',
  'dashboard.hotspots': 'बार-बार आने वाले लक्षण शब्द',
  'dashboard.heuristic':
    'यह गिनती बीज डेटा पर बनी पहली-पीढ़ी की गणना से आई है। कोई प्रशिक्षित मॉडल नहीं, और रोग की पहचान नहीं।',
  'dashboard.empty': 'अभी जोड़ने लायक कुछ नहीं।',
  'dashboard.referrals.closedVsOpen': 'बंद {closed} · खुले {open}',
  'dashboard.referrals.throughput': 'उठाए गए {total} में से {percent}% बंद हुए।',
  'dashboard.terms.method':
    'तरीक़ा: दर्ज लक्षण-पाठ में शब्दों की गिनती, हर विज़िट में एक बार। ये शब्द हैं, रोग की पहचान नहीं।',
  'dashboard.hotspot.title': 'गाँव के अनुसार लक्षणों का भार',
  'dashboard.hotspot.method':
    'तरीक़ा: पिछले {days} दिनों में हर गाँव के लिए दर्ज स्वास्थ्य रिकॉर्ड गिनें, फिर उस गिनती को बाँटें — {elevated} से कम पर निगरानी, {elevated} से {elevatedMax} तक बढ़ा हुआ, {concentrated} या उससे ज़्यादा पर केंद्रित।',
  'dashboard.hotspot.unattributed':
    'इस अवधि के {counted} रिकॉर्ड में से {unattributed} में गाँव दर्ज नहीं है, इसलिए वे किसी गाँव में नहीं गिने गए।',
  'dashboard.hotspot.band.watch': 'निगरानी',
  'dashboard.hotspot.band.elevated': 'बढ़ा हुआ',
  'dashboard.hotspot.band.concentrated': 'केंद्रित',
  'dashboard.hotspot.row': '{village}: {count} रिकॉर्ड, {band}',

  /* ——— Offline_Queue ——— */
  'offline.online': 'ऑनलाइन',
  'offline.offline': 'ऑफ़लाइन — आपकी जानकारी इस डिवाइस पर सुरक्षित है',
  'offline.pending': 'सिंक होने का इंतज़ार',
  'offline.failed': 'सिंक नहीं हो सका',
  'offline.retry': 'फिर से सिंक करें',
  'offline.syncing': 'सिंक हो रहा है…',
  'offline.synced': 'सब कुछ सिंक हो गया',
  'offline.simulate': 'ऑफ़लाइन जैसा चलाएँ',
  'offline.simulate.on': 'ऑफ़लाइन जैसा चल रहा है',
  'offline.simulate.off': 'फिर ऑनलाइन',
  'offline.queue.title': 'सिंक का इंतज़ार',
  'offline.queue.empty': 'सिंक के लिए कुछ नहीं।',
  'offline.queue.kind.intake': 'विज़िट',
  'offline.queue.kind.referral': 'रेफ़रल',
  'offline.queue.kind.prescription': 'दवा पर्ची',
  'offline.queue.kind.clinical-decision': 'डॉक्टर का निर्णय',
  'offline.queue.attempts': 'कोशिशें',
  'offline.token.assignedOnSync': 'टोकन बाक़ी — सिंक होने पर मिलेगा।',

  /* ——— Voice_Module ——— */
  'voice.listen': 'सुनें',
  'voice.stop': 'रोकें',
  'voice.speak': 'बोलें',
  'voice.listening': 'सुना जा रहा है…',
  'voice.speaking': 'बोला जा रहा है…',
  'voice.unsupported': 'इस ब्राउज़र में आवाज़ उपलब्ध नहीं है। टाइप करें।',
  'voice.noVoice': 'इस भाषा की आवाज़ इस डिवाइस पर नहीं है। सलाह लिखी हुई दिखाई गई है।',
  'voice.interim': 'अब तक सुना',
  'voice.error.noSpeech': 'कुछ सुनाई नहीं दिया। "सुनें" दबाकर फिर बोलें, या टाइप करें।',
  'voice.error.notAllowed': 'माइक की अनुमति नहीं मिली। लक्षण टाइप करें।',

  /* ——— QR_Module ——— */
  'qr.title': 'मरीज़ कार्ड',
  'qr.scan': 'कार्ड स्कैन करें',
  'qr.scanning': 'कैमरा कार्ड की तरफ़ रखें',
  'qr.print': 'कार्ड छापें',
  'qr.notFound': 'इस कार्ड का कोई मरीज़ नहीं मिला। फिर कोशिश करें।',
  'qr.manual': 'कार्ड नंबर हाथ से लिखें',
  'qr.manual.placeholder': 'SS-WRD-…',
  'qr.id': 'कार्ड नंबर',
  'qr.unsupported': 'कैमरा उपलब्ध नहीं है। कार्ड नंबर लिखें।',

  /* ——— Common actions and states ——— */
  'common.save': 'सहेजें',
  'common.cancel': 'रद्द करें',
  'common.continue': 'आगे बढ़ें',
  'common.back': 'पीछे',
  'common.retry': 'फिर कोशिश करें',
  'common.close': 'बंद करें',
  'common.edit': 'बदलें',
  'common.done': 'पूरा हुआ',
  'common.loading': 'लोड हो रहा है…',
  'common.saving': 'सहेजा जा रहा है…',
  'common.error': 'कुछ गड़बड़ हो गई।',
  'common.empty': 'अभी यहाँ कुछ नहीं।',
  'common.optional': 'वैकल्पिक',
  'common.required': 'ज़रूरी',
  'common.resetDemo': 'प्रदर्शन डेटा रीसेट करें',
  'common.resetDemo.caption': 'इस सत्र में बनाया गया सब कुछ हट जाएगा।',
  'common.yes': 'हाँ',
  'common.no': 'नहीं',
};

export default hiIN;
