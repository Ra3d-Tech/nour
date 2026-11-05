# ayah.py
"""
مولد آية اليوم التلقائي من بين جميع آيات القرآن الكريم الـ 6,236 آية
يجلب نص الآية العثماني ورقم الصفحة الدقيق في المصحف والتفسير الميسر
"""

import sys
import json
import datetime
import urllib.request
import random

TOTAL_QURAN_AYAHS = 6236

def get_daily_ayah_number():
    """حساب رقم الآية اليومية تلقائياً من 1 إلى 6236 بناءً على تاريخ اليوم"""
    today = datetime.date.today()
    # توليد رقم فريد ومتغير يومياً يغطي كامل آيات القرآن
    day_number = (today.year * 365 + today.timetuple().tm_yday * 17) % TOTAL_QURAN_AYAHS + 1
    return day_number

def fetch_ayah_data(ayah_number: int):
    """جلب بيانات الآية بالرسم العثماني ورقم الصفحة والتفسير الميسر"""
    url = f"https://api.alquran.cloud/v1/ayah/{ayah_number}/editions/quran-uthmani,ar.muyassar"
    print(f"⏳ جاري جلب الآية رقم ({ayah_number}) من أصل {TOTAL_QURAN_AYAHS} آية...")
    
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            
            if res_data.get("code") == 200 and len(res_data.get("data", [])) >= 2:
                uthmani_edition = res_data["data"][0]
                tafseer_edition = res_data["data"][1]

                surah_info = uthmani_edition["surah"]
                
                clean_surah_name = surah_info["name"].replace("سُورَةُ", "").strip()

                result = {
                    "globalNumber": uthmani_edition["number"],
                    "surah": surah_info["number"],
                    "ayah": uthmani_edition["numberInSurah"],
                    "surahName": clean_surah_name,
                    "page": uthmani_edition["page"],
                    "juz": uthmani_edition["juz"],
                    "text": uthmani_edition["text"],
                    "tafseer": tafseer_edition["text"],
                    "date": datetime.date.today().isoformat()
                }
                return result
    except Exception as e:
        print(f"❌ حدث خطأ أثناء الاتصال: {e}")
        return None

def main():
    # إذا أردت آية عشوائية شغل: python ayah.py random
    if len(sys.argv) > 1 and sys.argv[1].lower() in ["--random", "random", "-r"]:
        ayah_num = random.randint(1, TOTAL_QURAN_AYAHS)
        print(f"🎲 تم اختيار آية عشوائية برقم: {ayah_num}")
    else:
        ayah_num = get_daily_ayah_number()
        print(f"📅 آية اليوم المجدولة برقم: {ayah_num}")

    data = fetch_ayah_data(ayah_num)

    if data:
        print("\n✨ بيانات الآية المستخرجة بنجاح:")
        print(f"📖 سورة: {data['surahName']} | الآية رقم: ({data['ayah']})")
        print(f"📄 صفحة المصحف: {data['page']} | الجزء: {data['juz']}")
        print(f"💬 الآية: « {data['text']} »")
        print(f"📚 التفسير: {data['tafseer'][:120]}...")

        # حفظ البيانات في ملف daily_ayah.json لاستخدامه داخل التطبيق
        output_file = "daily_ayah.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ تم حفظ ملف [{output_file}] بنجاح ليقرأه التطبيق فوراً!")

if __name__ == "__main__":
    main()