import DonorDetail from "../../donor-detail";

export default async function DonorPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return <DonorDetail donorCardId={Number(id)}/>;
}
