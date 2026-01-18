import RecommendationsSection from "../component/RecommendSection.jsx";
import Header from "./Movies/Header";
import MoviesContainerPage from "./Movies/MoviesContainerPage";

const Home = () => {
  return (
    <>
      <Header />

      <section className="mt-[10rem]">
        <RecommendationsSection />
        <MoviesContainerPage />
      </section>
    </>
  );
};

export default Home;
