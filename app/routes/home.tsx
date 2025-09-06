import type { Route } from "./+types/home";
import Navbar from "~/components/Navbar";
import {resumes} from "../../constants";
import ResumeCard from "~/components/ResumeCard";
import {usePuterStore} from "~/lib/puter";
import {useLocation, useNavigate} from "react-router";
import {useEffect} from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {

    const { auth } = usePuterStore();
    const navigate = useNavigate();

    // this will redirect user to the desired page which he wanted to access before signing in
    useEffect(()=>{
        if(!auth.isAuthenticated){
            navigate('/auth?next=/');
        }
    },[auth.isAuthenticated])

  return <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar/>
      <section className="main-section">
          <div className="page-heading py-16">
              <h1>Track Your Applications & Resume Ratings</h1>
              <h2>Review your submission and check AI_powered feedback.</h2>
          </div>

          {resumes.length > 0 && (
                  <div className="resumes-section">
                      {resumes.map((resume)=>(
                          <ResumeCard key={resume.id} resume={resume}/>
                      ))}
                  </div>
              )}
      </section>
  </main>;
}
