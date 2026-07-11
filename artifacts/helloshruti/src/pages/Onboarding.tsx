import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProfile } from '@/hooks/use-profile';
import { Card } from '@/components/ui/card';
import { Check, ChevronRight, Mic } from 'lucide-react';

const TOPICS = [
  "Taxation", "GST", "Finance", "Business", 
  "Government policies", "Skill development", 
  "Social sector", "Technology", "Maharashtra news"
];

const CONTENT_LANGUAGES = ["English", "मराठी (Marathi)", "हिंदी (Hindi)"];

const COUNTRIES = ["India", "United States", "United Kingdom", "Other"];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { getProfile, saveProfile } = useProfile();
  const { user } = useUser();

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [language, setLanguage] = useState('English');
  const [contentLanguages, setContentLanguages] = useState<string[]>(['English']);
  const [country, setCountry] = useState('India');
  const [interests, setInterests] = useState<string[]>([]);
  const [readingLength, setReadingLength] = useState('Detailed summary ~5 min');
  const [briefingTime, setBriefingTime] = useState('08:00');

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      saveProfile({
        name,
        nickname: nickname || name,
        language,
        contentLanguages,
        country,
        interests,
        readingLength,
        briefingTime
      });
      setLocation('/dashboard');
    }
  };

  useEffect(() => {
    if (getProfile()) {
      setLocation('/dashboard');
      return;
    }
    // Prefill from Clerk profile so returning users don't retype their name.
    const fullName = user?.fullName || user?.firstName;
    if (fullName) setName(fullName);
  }, [user]);

  const toggleInterest = (topic: string) => {
    if (interests.includes(topic)) {
      setInterests(interests.filter(t => t !== topic));
    } else if (interests.length < 5) {
      setInterests([...interests, topic]);
    }
  };

  const toggleContentLanguage = (lang: string) => {
    if (contentLanguages.includes(lang)) {
      if (contentLanguages.length > 1) {
        setContentLanguages(contentLanguages.filter(l => l !== lang));
      }
    } else {
      setContentLanguages([...contentLanguages, lang]);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background px-6 py-12 md:py-24 max-w-2xl mx-auto">
      <div className="flex-1 flex flex-col">
        {/* Progress indicator */}
        <div className="flex gap-2 mb-12">
          {[1, 2, 3, 4].map(s => (
            <div 
              key={s} 
              className={`h-2 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-secondary'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1">
            <h1 className="text-4xl md:text-5xl font-serif text-primary mb-4 leading-tight">
              Hello. <br/>I'm Shruti.
            </h1>
            <p className="text-xl text-muted-foreground mb-12">
              I'll be reading your daily briefings. What should I call you?
            </p>
            
            <div className="space-y-8">
              <div>
                <label className="block text-lg font-medium text-foreground mb-3">Your full name</label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Anand Kulkarni"
                  className="text-xl bg-white"
                />
              </div>
              
              <div>
                <label className="block text-lg font-medium text-foreground mb-3">What do you prefer to be called?</label>
                <Input 
                  value={nickname} 
                  onChange={e => setNickname(e.target.value)} 
                  placeholder="e.g. Mr. Kulkarni, or Anand"
                  className="text-xl bg-white"
                />
                <p className="text-sm text-muted-foreground mt-2">Leave blank if same as above.</p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1">
            <h1 className="text-4xl font-serif text-primary mb-4 leading-tight">
              Language &amp; region
            </h1>
            <p className="text-xl text-muted-foreground mb-10">
              Tell me how to talk to you, and what to read to you.
            </p>

            <div className="mb-10">
              <label className="block text-lg font-medium text-foreground mb-3">
                Which language should I speak and listen in?
              </label>
              <div className="space-y-4">
                <Card 
                  className={`cursor-pointer transition-colors p-6 ${language === 'English' ? 'border-primary ring-2 ring-primary bg-primary/5' : 'bg-white'}`}
                  onClick={() => setLanguage('English')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-medium">English</span>
                    {language === 'English' && <Check className="w-8 h-8 text-primary" />}
                  </div>
                </Card>
                
                <Card className="p-6 bg-secondary/50 border-dashed opacity-70">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-medium text-muted-foreground">मराठी</span>
                    <span className="text-sm px-3 py-1 bg-secondary text-secondary-foreground rounded-full font-medium">Coming soon</span>
                  </div>
                </Card>
                
                <Card className="p-6 bg-secondary/50 border-dashed opacity-70">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-medium text-muted-foreground">हिंदी</span>
                    <span className="text-sm px-3 py-1 bg-secondary text-secondary-foreground rounded-full font-medium">Coming soon</span>
                  </div>
                </Card>
              </div>
            </div>

            <div className="mb-10">
              <label className="block text-lg font-medium text-foreground mb-3">
                Which language(s) would you like your news content in?
              </label>
              <p className="text-base text-muted-foreground mb-4">
                Select all that apply. We'll bring in content in these languages as it becomes available.
              </p>
              <div className="flex flex-wrap gap-3">
                {CONTENT_LANGUAGES.map(lang => {
                  const isSelected = contentLanguages.includes(lang);
                  return (
                    <button
                      key={lang}
                      onClick={() => toggleContentLanguage(lang)}
                      className={`px-5 py-3 rounded-xl text-lg font-medium transition-all ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground shadow-md' 
                          : 'bg-white border border-border text-foreground hover:border-primary'
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-lg font-medium text-foreground mb-3">
                Which country are you in?
              </label>
              <div className="flex flex-wrap gap-3">
                {COUNTRIES.map(c => {
                  const isSelected = country === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCountry(c)}
                      className={`px-5 py-3 rounded-xl text-lg font-medium transition-all ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground shadow-md' 
                          : 'bg-white border border-border text-foreground hover:border-primary'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1">
            <h1 className="text-4xl font-serif text-primary mb-4 leading-tight">
              What topics are important to you?
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Select up to 5 topics so I can curate your daily briefing.
            </p>
            
            <div className="flex flex-wrap gap-3">
              {TOPICS.map(topic => {
                const isSelected = interests.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleInterest(topic)}
                    className={`px-5 py-3 rounded-xl text-lg font-medium transition-all ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'bg-white border border-border text-foreground hover:border-primary'
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
            
            <p className="text-muted-foreground mt-8">
              {interests.length} / 5 selected
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1">
            <h1 className="text-4xl font-serif text-primary mb-12 leading-tight">
              How would you like your briefings?
            </h1>
            
            <div className="space-y-10">
              <div>
                <label className="block text-xl font-medium text-foreground mb-4">Preferred reading detail</label>
                <div className="space-y-3">
                  {['Quick summary ~2 min', 'Detailed summary ~5 min', 'Full article'].map(len => (
                    <Card 
                      key={len}
                      className={`cursor-pointer p-5 transition-colors ${readingLength === len ? 'border-primary ring-2 ring-primary bg-primary/5' : 'bg-white'}`}
                      onClick={() => setReadingLength(len)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{len}</span>
                        {readingLength === len && <Check className="w-6 h-6 text-primary" />}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xl font-medium text-foreground mb-4">Morning briefing time</label>
                <Input 
                  type="time" 
                  value={briefingTime} 
                  onChange={e => setBriefingTime(e.target.value)}
                  className="text-2xl bg-white h-20 px-6 max-w-[200px]"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 flex justify-between items-center pt-6 border-t border-border">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} className="text-lg">
              Back
            </Button>
          ) : (
            <div />
          )}
          
          <Button 
            size="lg" 
            onClick={handleNext}
            disabled={
              (step === 1 && !name) || 
              (step === 3 && interests.length === 0)
            }
            className="gap-2"
          >
            {step === 4 ? 'Start Reading' : 'Continue'} 
            {step < 4 && <ChevronRight className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}