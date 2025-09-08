import Navbar from "~/components/Navbar";
import {type FormEvent, useState} from "react";
import FileUploader from "~/components/FileUploader";
import {usePuterStore} from "~/lib/puter";
import {convertPdfToImage} from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import {prepareInstructions} from "../../constants";
import {useNavigate} from "react-router";

const Upload = () => {

    const {isLoading, auth, fs, kv, ai, error} = usePuterStore();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText]=useState("");
    const navigate = useNavigate();

    const [file,setFile]=useState<File|null>(null);

    const handleFileSelect = (file: File|null) => {
        setFile(file);
    }

    const handleAnalyze = async ({
                                     companyName,
                                     jobTitle,
                                     jobDescription,
                                     file
                                 }: {
        companyName: string;
        jobTitle: string;
        jobDescription: string;
        file: File;
    }) => {
        try {
            setIsProcessing(true);

            // Step 1: Upload original file
            setStatusText("Uploading the file ...");
            const uploadFile = await fs.upload([file]);
            if (!uploadFile) {
                setStatusText("Error: Failed to upload file");
                return;
            }
            console.log("File uploaded successfully:", uploadFile.path);

            // Step 2: Convert PDF to image
            setStatusText("Converting to image ...");
            const imageFile = await convertPdfToImage(file);
            console.log("PDF conversion result:", imageFile);

            // Check for conversion errors
            if (imageFile.error) {
                console.error("PDF conversion error:", imageFile.error);
                setStatusText(`Error: ${imageFile.error}`);
                return;
            }

            if (!imageFile.file) {
                setStatusText("Error: Failed to convert PDF to image");
                return;
            }

            // Step 3: Upload converted image
            setStatusText("Uploading the image ...");
            const uploadedImage = await fs.upload([imageFile.file]);
            if (!uploadedImage) {
                setStatusText("Error: Failed to upload image");
                return;
            }
            console.log("Image uploaded successfully:", uploadedImage.path);

            // Step 4: Prepare data
            setStatusText("Preparing Data ...");
            const uuid = generateUUID();
            console.log("id: ",uuid);
            const data = {
                id: uuid,
                resumePath: uploadFile.path,
                imagePath: uploadedImage.path,
                companyName,
                jobTitle,
                jobDescription,
                feedback: '',
            };

            // Save initial data
            // Test KV operation with detailed error handling
            try {
                console.log("💾 Attempting to save to KV store...");
                const kvKey = `resume:${uuid}`;
                const kvValue = JSON.stringify(data);

                console.log("🔑 KV Key:", kvKey);
                console.log("📋 KV Value length:", kvValue.length);
                console.log("📋 KV Value preview:", kvValue.substring(0, 200) + "...");

                // Try the KV set operation
                const kvResult = await kv.set(kvKey, kvValue);
                console.log("✅ KV set result:", kvResult);

                // Verify the data was saved by reading it back
                const kvVerify = await kv.get(kvKey);
                console.log("🔍 KV verification read:", kvVerify ? "SUCCESS" : "FAILED");

                if (!kvVerify) {
                    throw new Error("Data was not saved to KV store");
                }

            } catch (kvError) {
                console.error("❌ KV operation failed:", kvError);
                setStatusText(`Error: Failed to save data - ${kvError instanceof Error ? kvError.message : 'Unknown KV error'}`);
                return;
            }
            console.log("Data prepared and saved:", data);

            // Step 5: Analyze resume
            setStatusText("Analyzing ...");
            const feedback = await ai.feedback(
                uploadFile.path,
                prepareInstructions({ jobTitle, jobDescription }),
            );

            if (!feedback) {
                setStatusText("Error: Failed to analyze resume");
                return;
            }

            // Step 6: Process feedback
            console.log("AI feedback received:", feedback);

            let feedbackText: string;
            if (typeof feedback.message.content === "string") {
                feedbackText = feedback.message.content;
            } else {
                feedbackText = feedback.message.content[0].text;
            }

            // Parse and save feedback
            try {
                data.feedback = JSON.parse(feedbackText);
            } catch (parseError) {
                console.error("Failed to parse feedback JSON:", parseError);
                console.log("Raw feedback text:", feedbackText);
                setStatusText("Error: Failed to parse analysis results");
                return;
            }

            await kv.set(`resume:${uuid}`, JSON.stringify(data));

            // Step 7: Navigate to results
            setStatusText("Analysis completed, rendering...");
            console.log("Final data:", data);
            navigate(`/resume/${uuid}`);

        } catch (error) {
            console.error("Error in handleAnalyze:", error);
            setStatusText(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSubmit= async(e:FormEvent<HTMLFormElement>)=>{
        e.preventDefault();
        const form = e.currentTarget.closest("form");
        if(!form) return;
        const formData = new FormData(form);

        const companyName = formData.get("company-name") as string;
        const jobTitle = formData.get("job-title") as string;
        const jobDescription = formData.get("job-description") as string;

        if(!file) return;

        await handleAnalyze({companyName,jobTitle,jobDescription,file});
    }

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar/>
            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src={"/images/resume-scan.gif"} className="w-full"/>
                        </>
                    ):(
                        <h2>Drop your resume for an ATS score and improvement tips</h2>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name">Company Name</label>
                                <input type="text" name="company-name" id="company-name" placeholder="Company Name"/>
                            </div>

                            <div className="form-div">
                                <label htmlFor="job-title">Job Title</label>
                                <input type="text" name="job-title" id="job-title" placeholder="Job Title"/>
                            </div>

                            <div className="form-div">
                                <label htmlFor="job-description">Job Description</label>
                                <textarea rows={5} name="job-description" id="job-description" placeholder="Job Description"/>
                            </div>

                            <div className="form-div">
                                <label htmlFor="uploader">Upload Resume</label>
                                <FileUploader onSelectFile={handleFileSelect}/>
                            </div>

                            <button type="submit" className="primary-button">Analyze Resume</button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}
export default Upload
