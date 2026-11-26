/**
 * #2473 review: a C++ member function template as far as a call's argument
 * count reaches it. 1.3 does not declare the template, so a call it can take
 * is not judged, and a call it cannot take is judged by the other overloads.
 */
interface ICppMemberTemplate {
  readonly name: string;
  /** Its parameters but a trailing pack: each records a default argument */
  readonly parameters: readonly { readonly hasDefault?: true }[];
  /** A pack or `...`: it takes any number of arguments past `parameters` */
  readonly isVariadic: boolean;
}

export default ICppMemberTemplate;
